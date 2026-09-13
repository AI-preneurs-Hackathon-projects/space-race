"use client";
import {useCallback,useEffect,useRef} from 'react';
import {CockpitVoice} from '@/lib/game/cockpit-voice';

export function useCockpitVoice(enabled:boolean,session:number,message:string){
 const voice=useRef<CockpitVoice|null>(null);
 const prime=useCallback(()=>{voice.current??=new CockpitVoice();voice.current.prime();},[]);
 useEffect(()=>{voice.current??=new CockpitVoice();voice.current.update(enabled,session,message);},[enabled,session,message]);
 useEffect(()=>()=>{voice.current?.dispose();voice.current=null;},[]);
 return prime;
}
