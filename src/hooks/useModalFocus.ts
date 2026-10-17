import {useEffect,useRef} from 'react';
/** Keep keyboard focus inside the active dialog, including when dialogs are nested. */
export function useModalFocus(open:boolean,onClose:()=>void){
  const panel=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    if(!open)return;const before=document.activeElement as HTMLElement|null;
    const controls=()=>[...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')||[])].filter(node=>node.getClientRects().length>0);
    controls()[0]?.focus();
    const key=(event:KeyboardEvent)=>{
      if(!panel.current?.contains(document.activeElement))return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();return;}
      if(event.key!=='Tab')return;const nodes=controls(),first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);if(before?.isConnected)before.focus();};
  },[open]);
  return panel;
}
