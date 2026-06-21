import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useToastStore } from './store/toastStore';

window.alert = (message: string) => {
  useToastStore.getState().addToast(message);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
