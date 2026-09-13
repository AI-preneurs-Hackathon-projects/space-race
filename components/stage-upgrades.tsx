import {Shield,Zap,ArrowRight} from 'lucide-react';
import {HULL_CAP,HULL_STEP,CRUISE_CAP,CRUISE_STEP,effectiveHull,type Campaign,type Upgrade} from '@/lib/game/progression';
import type {Hull} from '@/lib/game/types';
export default function StageUpgrades({campaign,hull,onChoose}:{campaign:Campaign;hull:Hull;onChoose:(kind:Upgrade|'continue')=>void}){
 const ship=effectiveHull(hull,campaign),hullFull=campaign.hullUpgrades>=HULL_CAP,cruiseFull=campaign.cruiseUpgrades>=CRUISE_CAP;
 if(hullFull&&cruiseFull)return <div className="stage-upgrades"><p>Stage {campaign.stage} cleared. Your ship is fully upgraded.</p><div className="upgrades-complete"><span><Shield size={18}/> Hull maxed</span><span><Zap size={18}/> Cruise maxed</span></div><button className="primary-button" onClick={()=>onChoose('continue')}>Continue to stage {campaign.stage+1}<ArrowRight size={18}/></button><small>Continue enters the gate. All earned upgrades carry forward.</small></div>;
 return <div className="stage-upgrades"><p>Stage {campaign.stage} cleared. Choose one upgrade for stage {campaign.stage+1}.</p><div className="upgrade-grid">
 <button disabled={hullFull} onClick={()=>onChoose('hull')} className="upgrade-choice"><Shield size={23}/><b>Reinforce hull</b><strong>{hullFull?'MAXED':`${ship.armor} → ${ship.armor+HULL_STEP}`}</strong><span>{hullFull?'Five armor upgrades earned':`+${HULL_STEP} max armor · repaired at Warp Gates`}</span></button>
 <button disabled={cruiseFull} onClick={()=>onChoose('cruise')} className="upgrade-choice"><Zap size={23}/><b>Boost cruise</b><strong>{cruiseFull?'MAXED':`${Math.round((ship.cruise??1)*100)}% → ${Math.round(((ship.cruise??1)+CRUISE_STEP)*100)}%`}</strong><span>{cruiseFull?'Four cruise upgrades earned':'+5% base speed · shorter delivery'}</span></button>
 </div><small>Choose an upgrade to enter the gate and begin the next stage.</small></div>;
}
