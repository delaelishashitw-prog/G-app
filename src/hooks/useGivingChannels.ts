import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '../contexts/AuthContext';
import {loadGivingChannels,type GivingChannelAccount} from '../lib/givingChannels';

export function useGivingChannels(enabled=true,manage=false){
  const {isAuthenticated,currentUser}=useAuth();
  const scope=enabled&&isAuthenticated?`${currentUser.id}:${currentUser.role}:${manage}`:'';
  const latest=useRef(scope);latest.current=scope;
  const sequence=useRef(0);
  const [state,setState]=useState({scope:'',channels:[] as GivingChannelAccount[],loading:false,error:''});
  const refresh=useCallback(async()=>{
    if(!scope)return;const ticket=++sequence.current;
    setState(previous=>({scope,channels:manage&&previous.scope===scope?previous.channels:[],loading:true,error:''}));
    try{const channels=await loadGivingChannels(manage);if(latest.current===scope&&ticket===sequence.current)setState({scope,channels,loading:false,error:''});}
    catch(cause){if(latest.current===scope&&ticket===sequence.current)setState({scope,channels:[],loading:false,error:'Giving details could not be confirmed. Reconnect or contact the church office.'});}
  },[scope,manage]);
  useEffect(()=>{
    void refresh();const reload=()=>{if(document.visibilityState==='visible')void refresh();};
    window.addEventListener('online',reload);window.addEventListener('focus',reload);window.addEventListener('gwcc-giving-channels-updated',reload);
    const timer=scope?window.setInterval(reload,30000):undefined;
    return()=>{++sequence.current;window.clearInterval(timer);window.removeEventListener('online',reload);window.removeEventListener('focus',reload);window.removeEventListener('gwcc-giving-channels-updated',reload);};
  },[scope,refresh]);
  return {...(state.scope===scope?state:{scope,channels:[],loading:Boolean(scope),error:''}),refresh};
}
