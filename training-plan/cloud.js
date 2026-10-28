import {API_URL} from './service-config.js?v=coach3';
export class Cloud {
  constructor(){this.session=null;this.refreshing=null;try{this.session=JSON.parse(localStorage.getItem('hpe-session')||sessionStorage.getItem('hpe-session')||'null');}catch{}}
  get configured(){return API_URL.startsWith('https://');}
  async request(path,{method='GET',body,auth=true}={}){
    if(!this.configured)throw Error('The private account service has not been connected yet.');
    if(auth){await this.refresh();if(!this.session)throw Error('Please sign in again.');}
    const response=await fetch(API_URL.replace(/\/$/,'')+path,{method,cache:'no-store',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+this.session.access_token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
    const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{throw Error('The service returned an unexpected response. Nothing was confirmed saved.');}
    if(!response.ok)throw Error(data?.message||data?.msg||data?.error_description||'Request failed. Try again.');
    return data;
  }
  accept(session){session.expires_at=Date.now()+session.expires_in*1000;localStorage.setItem('hpe-session',JSON.stringify(session));sessionStorage.removeItem('hpe-session');this.session=session;}
  async refresh(){if(!this.session||this.session.expires_at>Date.now()+60000)return;if(this.refreshing)return this.refreshing;this.refreshing=this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:this.session.refresh_token},auth:false}).then(s=>this.accept(s)).finally(()=>this.refreshing=null);return this.refreshing;}
  async sendLink(email){const bytes=crypto.getRandomValues(new Uint8Array(48));const encode=b=>btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');const verifier=encode(bytes);const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));localStorage.setItem('hpe-pkce',verifier);const redirect=new URL('account.html',location.href).href;await this.request('/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{method:'POST',auth:false,body:{email,code_challenge:challenge,code_challenge_method:'s256'}});}
  async accountEmail(path,email,password){const bytes=crypto.getRandomValues(new Uint8Array(48));const encode=b=>btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');const verifier=encode(bytes);const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));localStorage.setItem('hpe-pkce',verifier);if(path==='recover')localStorage.setItem('hpe-recovery','1');else localStorage.removeItem('hpe-recovery');const redirect=new URL('account.html',location.href).href;return this.request('/auth/v1/'+path+'?redirect_to='+encodeURIComponent(redirect),{method:'POST',auth:false,body:{email,...(password?{password}:{}),code_challenge:challenge,code_challenge_method:'s256'}});}
  async passwordSignIn(email,password){this.accept(await this.request('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email,password}}));}
  async changePassword(password){await this.request('/auth/v1/user',{method:'PUT',body:{password}});localStorage.removeItem('hpe-recovery');}
  async finish(){const url=new URL(location.href);const code=url.searchParams.get('code');if(!code)return false;history.replaceState({},'',url.pathname);const verifier=localStorage.getItem('hpe-pkce');if(!verifier)throw Error('Open the link in the browser where you requested it, or request a new link.');const session=await this.request('/auth/v1/token?grant_type=pkce',{method:'POST',auth:false,body:{auth_code:code,code_verifier:verifier}});this.accept(session);localStorage.removeItem('hpe-pkce');return true;}
  async signOut(){try{if(this.session)await this.request('/auth/v1/logout',{method:'POST'});}finally{this.session=null;sessionStorage.removeItem('hpe-session');localStorage.removeItem('hpe-session');localStorage.removeItem('hpe-pkce');localStorage.removeItem('hpe-recovery');}}
  rpc(name,body={}){return this.request('/rest/v1/rpc/'+name,{method:'POST',body});}
  table(name,query=''){return this.request('/rest/v1/'+name+'?select=*'+query);}
}
