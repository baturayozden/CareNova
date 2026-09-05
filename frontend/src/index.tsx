import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App';
import reportWebVitals from './reportWebVitals';

const container = document.getElementById('root') as HTMLElement;

// carenova.ai's root route (and the other marketing paths) are rewritten at
// the CDN to a static, pre-rendered snapshot for crawlers/first paint — see
// frontend/scripts/prerender.js and the root vercel.json rewrites. That
// snapshot's markup lives inside #root when this script runs. createRoot()
// does NOT clear pre-existing non-React children before its first render —
// it only manages nodes it created — so without this, the live app mounts
// ALONGSIDE the frozen snapshot instead of replacing it: the page doubles in
// height and every Framer Motion element in the dead snapshot stays stuck at
// its captured mid-animation opacity:0 forever, since no React/JS ever
// touches it again.
container.innerHTML = '';

const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
