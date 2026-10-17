import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {useAuth} from './AuthContext';
import {loadFollowUpTasks,type FollowUpTask} from '../lib/followUp';
interface FollowUpState {tasks:FollowUpTask[];loading:boolean;error:string;refreshTasks:()=>Promise<void>;acceptTask:(task:FollowUpTask)=>void}
const Context=createContext<FollowUpState|undefined>(undefined);
export function FollowUpProvider({children}:{children:React.ReactNode}){
  const {isAuthenticated,currentUser}=useAuth();
  const enabled=isAuthenticated&&currentUser.role!=='member';const scope=enabled?`${currentUser.id}:${currentUser.role}`:'';
  const latest=useRef(scope);latest.current=scope;const request=useRef(0),alive=useRef(true);
  const [records,setRecords]=useState<{scope:string;tasks:FollowUpTask[]}>({scope:'',tasks:[]});
  const [state,setState]=useState<{scope:string;loading:boolean;error:string}>({scope:'',loading:false,error:''});
  const refreshTasks=useCallback(async()=>{
    if(!scope)return;const sequence=++request.current;setState({scope,loading:true,error:''});
    try{const tasks=await loadFollowUpTasks();if(alive.current&&latest.current===scope&&sequence===request.current){setRecords({scope,tasks});setState({scope,loading:false,error:''});}}
    catch(cause){if(alive.current&&latest.current===scope&&sequence===request.current){setRecords({scope,tasks:[]});setState({scope,loading:false,error:(cause as Error).message});}}
  },[scope]);
  const acceptTask=useCallback((task:FollowUpTask)=>{
    if(!scope||latest.current!==scope)return;++request.current;
    setRecords(prev=>({scope,tasks:[task,...(prev.scope===scope?prev.tasks:[]).filter(row=>row.id!==task.id)]}));setState({scope,loading:false,error:''});
  },[scope]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;++request.current;};},[]);
  useEffect(()=>{
    ++request.current;setRecords({scope,tasks:[]});setState({scope,loading:false,error:''});
    if(!scope)return;void refreshTasks();
    const refresh=()=>{if(document.visibilityState==='visible')void refreshTasks();};
    window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('gwcc-refresh-follow-ups',refresh);
    return()=>{++request.current;window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('gwcc-refresh-follow-ups',refresh);};
  },[scope,refreshTasks]);
  return <Context.Provider value={{tasks:records.scope===scope?records.tasks:[],loading:state.scope===scope&&state.loading,error:state.scope===scope?state.error:'',refreshTasks,acceptTask}}>{children}</Context.Provider>;
}
export function useFollowUp(){const value=useContext(Context);if(!value)throw new Error('Follow-up provider is missing.');return value;}
