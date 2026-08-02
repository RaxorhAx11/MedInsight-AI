import React from 'react';
import { marked } from 'marked';
import styles from './styles.module.css';

const BotResponse = ({ response, text }) => {
	let rawText = response !== undefined ? response : text;

	if (typeof rawText === 'object' && rawText !== null && rawText.$$typeof === Symbol.for('react.element')) {
		rawText = rawText.props.response || rawText.props.text || '';
	}

	if (typeof rawText !== 'string') {
		rawText = String(rawText || '');
	}

	// Parse markdown to HTML
	const parsedHTML = marked.parse(rawText, { gfm: true, breaks: true });

	return (
		<div 
			className={styles.botResponse} 
			dangerouslySetInnerHTML={{ __html: parsedHTML }} 
		/>
	);
};

export default BotResponse;
