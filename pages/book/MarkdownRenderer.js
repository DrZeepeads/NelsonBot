import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css';

const renderers = {
    link: ({href, children}) => {
        const videoFormats = ['.mp4', '.webm', '.ogg'];
        const isVideoLink = videoFormats.some(format => href.toLowerCase().endsWith(format));

        if (isVideoLink) {
            return (<video width="320" height="240" controls>
                    <source src={href} type={`video/${href.split('.').pop()}`}/>
                    Your browser does not support the video tag.
                </video>);
        } else {
            return <a href={href}>{children}</a>;
        }
    },
};

function MarkdownRenderer({markdownContent}) {
    return (<div className="markdown-body">
            <ReactMarkdown components={renderers} remarkPlugins={[remarkGfm]}>
                {markdownContent}
            </ReactMarkdown>
        </div>);
}

export default MarkdownRenderer;