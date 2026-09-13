import { AIError,aiFailure,generateJSON,readInput } from '@/lib/game/ai';
import {difficulty} from '@/lib/game/progression';
import {validateDirectorContext,validateSectionPlan,sectionPlanSchema,sectionPlanPrompt} from '@/lib/game/section-director';
export async function POST(request:Request){try{
 let context;try{context=validateDirectorContext(await readInput(request));}catch(e){if(e instanceof AIError)throw e;throw new AIError('The section planning context is invalid.',400);}
 if(context.condition.hull<=0||context.condition.cargo<=0)throw new AIError('This run has ended. Start a retry before planning.',400);
 const result=await generateJSON('cargo_section',sectionPlanSchema(context),sectionPlanPrompt(context));
 return Response.json({plan:validateSectionPlan(result,difficulty(context.stage,context.difficulty).waves)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return aiFailure(e);}}
