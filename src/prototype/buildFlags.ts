// Pure build-time policy. No provider configuration or application state is read.
export const productionChatBuildEnabled=(event:string|undefined,flag:string|undefined)=>event==='build' && flag==='true';
