import { env } from "cloudflare:workers";
export function aiConfig(){const values=env as unknown as Record<string,string|undefined>;return {key:values.OPENAI_API_KEY||process.env.OPENAI_API_KEY,model:values.OPENAI_MODEL||process.env.OPENAI_MODEL||"gpt-4.1-mini"};}
export class AIError extends Error { constructor(message:string,public status=503){super(message);} }
export async function readInput(request:Request,maxBytes=250000){
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)throw new AIError("This request must come from the game.",403);
 if(Number(request.headers.get("content-length"))>maxBytes)throw new AIError("The sketch is too large.",413);
 const reader=request.body?.getReader();if(!reader)throw new AIError("Missing request.",400);let total=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw new AIError("The sketch is too large.",413);}chunks.push(value);}
 const body=new Uint8Array(total);let i=0;for(const c of chunks){body.set(c,i);i+=c.length;}try{return JSON.parse(new TextDecoder().decode(body));}catch{throw new AIError("Invalid request.",400);}
}
// This bound is per Worker isolate. Site owner access remains the main access control.
let nextRequest=0;
export type JSONGenerationOptions={timeoutMs?:number;signal?:AbortSignal;maxOutputTokens?:number};
export async function generateJSON(name:string,schema:object,prompt:string,image?:string,options:JSONGenerationOptions={}){
 const {key,model}=aiConfig();if(!key)throw new AIError("OpenAI is not connected yet.");
 if(Date.now()<nextRequest)throw new AIError("The designer is busy. Wait a moment and try again.",429);nextRequest=Date.now()+2500;
 const timeout=AbortSignal.timeout(Math.max(1000,Math.min(25000,options.timeoutMs??25000)));
 const signal=options.signal?AbortSignal.any([timeout,options.signal]):timeout;
 const content:object[]=[{type:"input_text",text:prompt}];if(image)content.push({type:"input_image",image_url:image,detail:"low"});
 let response:Response;
 try{response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},signal,body:JSON.stringify({model,store:false,max_output_tokens:Math.max(500,Math.min(4000,options.maxOutputTokens??2400)),input:[{role:"user",content}],text:{format:{type:"json_schema",name,strict:true,schema}}})});}catch{throw new AIError("OpenAI took too long to respond. Try again, or use the local option.");}
 if(!response.ok)throw new AIError(response.status===429?"OpenAI is busy or its quota is unavailable. Try the local option.":"OpenAI could not complete this request. The local option is still available.");
 const data=await response.json() as {status:string;output?:{content?:{type:string;text?:string}[]}[]};
 const text=data.output?.flatMap(o=>o.content??[]).filter(c=>c.type==="output_text").map(c=>c.text??"").join("");
 if(data.status!=="completed"||!text)throw new AIError("OpenAI returned an incomplete design. Try again.");
 try{return JSON.parse(text);}catch{throw new AIError("OpenAI returned an unreadable design. Try again.");}
}
export function aiFailure(error:unknown){return Response.json({error:error instanceof Error?error.message:"The AI service is unavailable."},{status:error instanceof AIError?error.status:502,headers:{"Cache-Control":"no-store"}});}
