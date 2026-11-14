import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { DarkModeProvider } from './context/DarkModeContext';
import { PrintProvider } from './context/PrintContext';
import { UniversalPrintPortal } from './components/UniversalPrintPortal';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <DarkModeProvider>
    <PrintProvider>
      <App />
      <PrintPreviewModal />
      <UniversalPrintPortal />
    </PrintProvider>
  </DarkModeProvider>
);
