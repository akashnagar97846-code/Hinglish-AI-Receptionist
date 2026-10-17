import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './receptionist.css';

function setMeta(name: string, content: string, property = false) {
  const attribute = property ? 'property' : 'name';
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!element) { element = document.createElement('meta'); element.setAttribute(attribute, name); document.head.appendChild(element); }
  element.content = content;
}

function updateRouteMetadata() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const isReceptionist = path === '/receptionist';
  const title = isReceptionist ? 'Talk to the AI Receptionist | Beyond Tech Intelligence' : 'Beyond Tech Intelligence — AI Receptionist';
  const description = isReceptionist
    ? 'Talk to a Hinglish-speaking AI receptionist right in your browser and ask about services and pricing.'
    : 'Beyond Tech Intelligence provides a browser-first AI receptionist that speaks Hinglish, answers business questions and understands what customers need.';
  document.title = title;
  setMeta('description', description);
  setMeta('og:title', title, true);
  setMeta('og:description', description, true);
  setMeta('og:url', `${window.location.origin}${path === '/' ? '/' : path}`, true);
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = Object.assign(document.createElement('link'), { rel: 'canonical' }); document.head.appendChild(canonical); }
  canonical.href = `${window.location.origin}${path === '/' ? '/' : path}`;
}

updateRouteMetadata();
window.addEventListener('popstate', updateRouteMetadata);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);