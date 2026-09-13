import {stageEnvironment} from '@/lib/game/stage-environment';
import type {Campaign} from '@/lib/game/progression';
import styles from './route-map.module.css';
/** Isolated footer extension. Removing this component/import removes the complete map. */
export default function RouteMap({campaign}:{campaign:Campaign}){
 const stage=campaign.stage,cleared=campaign.status==='cleared';
 const nodes=[{stage:stage-1,name:stage===1?'Port Meridian':stageEnvironment(stage-1).name,state:stage===1?'ORIGIN':'COMPLETED'},
  {stage,name:stageEnvironment(stage).name,state:cleared?'COMPLETED':'CURRENT DESTINATION'},
  {stage:stage+1,name:stageEnvironment(stage+1).name,state:'NEXT CHECKPOINT'}];
 return <section className={styles.map} aria-label="Checkpoint route map"><div className={styles.title}><b>YOUR ROUTE</b><span>STAGE {stage} · OPEN FRONTIER</span></div><ol>{nodes.map((node,i)=><li key={node.stage} data-state={node.state} aria-current={i===1?'step':undefined}><i style={{background:i===0&&stage===1?'#77909a':stageEnvironment(Math.max(1,node.stage)).mapColor}}/><div><small>{node.state}</small><b>{node.name}</b></div></li>)}</ol></section>;
}
