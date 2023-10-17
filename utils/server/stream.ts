import { Message, Model } from '@/types/chat';

import { GenerateParameters, Status, statusSchema } from './schema';

const BASE_URL = 'https://api.runpod.ai/v2/';

export const LLMStream = async (
  systemPrompt: string,
  parameters: GenerateParameters,
  messages: Message[],
  model: Model,
) => {
  const endpointId = model === Model.PhindCodeLlamaV2 ? process.env.PHIND_CODE_LLAMA_V2_ENDPOINT_ID! : process.env.SLITHER_SOL_AUDITOR_ENDPOINT_ID!;
  const runID = await getNewRunID(systemPrompt, parameters, messages, endpointId, model);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async pull(controller) {
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const { status, stream } = await getStream(runID, endpointId);

        // If there are new chunks, send them to the client
        if (stream.length > 0) {
          const joinedChunks = stream.join('');
          controller.enqueue(encoder.encode(joinedChunks));
        }

        // If the status is 'COMPLETED', close the stream
        if (status === statusSchema.enum.COMPLETED) {
          controller.close();
          break;
        }
      }
    },
    cancel() {
      const res = cancelRun(runID, endpointId);
      console.log('🦀 Canceled the run: ', res);
    },
  });

  return stream;
};

const cancelRun = async (runID: string, endpointId: string) => {
  const url = `${BASE_URL}${endpointId}/cancel/${runID}`;

  const runResult = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.API_KEY}`,
    },
  });

  if (!runResult.ok) {
    throw new Error('Failed to cancel run');
  }

  const { status } = (await runResult.json()) as { status: Status };

  return status;
};

const getStream = async (runID: string, endpointId: string) => {
  const url = `${BASE_URL}${endpointId}/stream/${runID}`;

  const streamResult = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.API_KEY}`,
    },
  });

  if (!streamResult.ok) {
    throw new Error('Failed to get stream');
  }

  const result = (await streamResult.json()) as {
    status: Status;
    stream: { output: string }[];
  };

  console.log('🦀 Stream result: ', result);

  return { ...result, stream: result.stream.map((s) => s.output) };
};

const getNewRunID = async (
  systemPrompt: string,
  parameters: GenerateParameters,
  messages: Message[],
  endpointId: string,
  model: Model,
) => {
  const url = `${BASE_URL}${endpointId}/run`;
  const prompt = generatePrompt(messages, model, systemPrompt)

  console.log(prompt)
  
  const runResult = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.API_KEY}`,
    },
    body: JSON.stringify({
      input: {
        prompt,
        ...parameters,
      },
    }),
  });

  if (!runResult.ok) {
    console.log({result : await runResult.text(), url})
    throw new Error('Failed to get run ID');
  }

  const { id } = (await runResult.json()) as { id: string; status: Status };

  return id;
}

const generatePrompt = (messages: Message[], model: Model, systemPrompt?: string) => {
  let prompt  = '';
  switch(model) {
    case Model.PhindCodeLlamaV2:
       prompt = messages
        .map((message) =>
          message.role === 'user'
            ? `### User Message \n ${message.content}`
            : `### Assistant \n ${message.content}`,
        )
        .join('\n\n');
        return `### System Prompt\n\n${systemPrompt}\n\n${prompt}\n\n### Assistant \n`;
    case Model.SlitherSolAuditor:
       prompt = messages
        .map((message) =>
          message.role === 'user'
            ? `### INSTRUCTION\n\nList all the vulnerabilities from the following source code\n\n ### INPUT\n\n${message.content}`
            : `### Response\n\n${message.content}`,
        )
        .join('\n\n');
      return `Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.\n\n${prompt}\n\n### Response\n\n`;
    default: 
      throw new Error(`Invalid model. ${model} is not supported`)
    }
} ;
