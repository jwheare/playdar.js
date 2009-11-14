Playdar={VERSION:"0.5.1",SERVER_ROOT:"localhost",SERVER_PORT:"60210",STATIC_HOST:"http://www.playdar.org",STAT_TIMEOUT:2000,AUTH_COOKIE_NAME:"Playdar.Auth",AUTH_POPUP_NAME:"Playdar.AuthPopup",AUTH_POPUP_SIZE:{"w":500,"h":260},QUERIES_POPUP_NAME:"Playdar.QueriesPopup",QUERIES_POPUP_SIZE:{"w":640,"h":700},MAX_POLLS:4,MAX_CONCURRENT_RESOLUTIONS:5,USE_STATUS_BAR:true,USE_SCROBBLER:true,client:null,status_bar:null,player:null,auth_details:{name:window.document.title,website:window.location.protocol+"//"+window.location.host+"/"},nop:function(){
},setupClient:function(_1){
new Playdar.Client(_1);
},setupPlayer:function(_2){
new Playdar.Player(_2);
},unload:function(){
if(Playdar.player){
Playdar.player.stop_current(true);
}else{
if(Playdar.scrobbler){
Playdar.scrobbler.stop();
}
}
}};
Playdar.DefaultListeners={onStartStat:Playdar.nop,onStat:Playdar.nop,onStartManualAuth:Playdar.nop,onAuth:Playdar.nop,onAuthClear:Playdar.nop,onCancelResolve:Playdar.nop,onResults:Playdar.nop,onResolveIdle:Playdar.nop};
Playdar.Client=function(_3){
Playdar.client=this;
this.auth_token=false;
this.auth_popup=null;
this.listeners={};
this.results_handlers={};
this.resolve_qids=[];
this.last_qid="";
this.poll_counts={};
this.initialise_resolve();
this.register_listeners(Playdar.DefaultListeners);
this.register_listeners(_3);
this.uuid=Playdar.Util.generate_uuid();
};
Playdar.Client.prototype={register_listener:function(_4,_5){
_5=_5||Playdar.nop;
this.listeners[_4]=function(){
return _5.apply(Playdar.client,arguments);
};
},register_listeners:function(_6){
if(!_6){
return;
}
for(var _7 in _6){
this.register_listener(_7,_6[_7]);
}
return true;
},register_results_handler:function(_8,_9){
if(_9){
this.results_handlers[_9]=_8;
}else{
this.register_listener("onResults",_8);
}
},go:function(){
if(!this.is_authed()){
this.auth_token=Playdar.Util.getcookie(Playdar.AUTH_COOKIE_NAME);
}
this.stat();
},stat:function(_a){
if(!_a){
this.listeners.onStartStat();
}
setTimeout(function(){
Playdar.client.check_stat_timeout();
},Playdar.STAT_TIMEOUT);
Playdar.Util.loadjs(this.get_url("stat","handle_stat"));
},check_stat_timeout:function(){
if(!this.stat_response||this.stat_response.name!="playdar"){
this.listeners.onStat(false);
}
},handle_stat:function(_b){
this.stat_response=_b;
if(Playdar.USE_STATUS_BAR){
new Playdar.StatusBar();
Playdar.status_bar.handle_stat(_b);
}
this.listeners.onStat(_b);
if(_b.authenticated){
if(!Playdar.scrobbler&&Playdar.USE_SCROBBLER&&_b.capabilities.audioscrobbler){
new Playdar.Scrobbler();
}
this.listeners.onAuth();
}else{
if(this.is_authed()){
this.clear_auth();
}
}
},clear_auth:function(){
Playdar.unload();
Playdar.Util.loadjs(this.get_revoke_url());
this.auth_token=false;
Playdar.Util.deletecookie(Playdar.AUTH_COOKIE_NAME);
this.cancel_resolve();
this.listeners.onAuthClear();
if(Playdar.status_bar){
Playdar.status_bar.offline();
}
},is_authed:function(){
if(this.auth_token){
return true;
}
return false;
},get_revoke_url:function(){
return this.get_base_url("/authcodes",{revoke:this.auth_token,jsonp:"Playdar.nop"});
},get_stat_link_html:function(_c){
_c=_c||"Retry";
var _d="<a href=\"#\""+" onclick=\"Playdar.client.go(); return false;"+"\">"+_c+"</a>";
return _d;
},get_auth_url:function(){
return this.get_base_url("/auth_1/",Playdar.auth_details);
},get_auth_link_html:function(_e){
_e=_e||"Connect";
var _f="<a href=\""+this.get_auth_url()+"\" target=\""+Playdar.AUTH_POPUP_NAME+"\" onclick=\"Playdar.client.start_auth(); return false;"+"\">"+_e+"</a>";
return _f;
},get_disconnect_link_html:function(_10){
_10=_10||"Disconnect";
var _11="<a href=\""+this.get_revoke_url()+"\" onclick=\"Playdar.client.clear_auth(); return false;"+"\">"+_10+"</a>";
return _11;
},start_auth:function(){
if(!this.auth_popup||this.auth_popup.closed){
this.auth_popup=window.open(this.get_auth_url(),Playdar.AUTH_POPUP_NAME,Playdar.Util.get_popup_options(Playdar.AUTH_POPUP_SIZE));
}else{
this.auth_popup.focus();
}
if(!Playdar.auth_details.receiverurl){
this.listeners.onStartManualAuth();
if(Playdar.status_bar){
Playdar.status_bar.start_manual_auth();
}
}
},auth_callback:function(_12){
Playdar.Util.setcookie(Playdar.AUTH_COOKIE_NAME,_12,365);
if(this.auth_popup&&!this.auth_popup.closed){
this.auth_popup.close();
this.auth_popup=null;
}
this.auth_token=_12;
this.stat(true);
},manual_auth_callback:function(_13){
var _14=document.getElementById(_13);
if(_14&&_14.value){
this.auth_callback(_14.value);
}
},autodetect:function(_15,_16){
if(!this.is_authed()){
return false;
}
var qid,i,j,_17,_18;
try{
var mf=Playdar.Parse.microformats(_16);
var _19=Playdar.Parse.rdfa(_16);
var _1a=mf.concat(_19);
for(i=0;i<_1a.length;i++){
_17=_1a[i];
for(j=0;j<_17.tracks.length;j++){
_18=_17.tracks[j];
if(_15){
qid=_15(_18);
}
this.resolve(_18.artist,_18.title,_18.album,qid);
}
}
return _1a;
}
catch(error){
console.warn(error);
}
},resolve:function(_1b,_1c,_1d,qid,url){
if(!this.is_authed()){
return false;
}
var _1e={artist:_1b||"",album:_1d||"",track:_1c||"",url:url||"",qid:qid||Playdar.Util.generate_uuid()};
if(Playdar.player){
_1e.mimetypes=Playdar.player.get_mime_types().join(",");
}
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.resolution_queue.push(_1e);
this.process_resolution_queue();
},process_resolution_queue:function(){
if(this.resolutions_in_progress.count>=Playdar.MAX_CONCURRENT_RESOLUTIONS){
return false;
}
var _1f=this.resolution_queue.length+this.resolutions_in_progress.count;
if(_1f){
var _20=Playdar.MAX_CONCURRENT_RESOLUTIONS-this.resolutions_in_progress.count;
for(var i=1;i<=_20;i++){
var _21=this.resolution_queue.shift();
if(!_21){
break;
}
this.resolutions_in_progress.queries[_21.qid]=_21;
this.resolutions_in_progress.count++;
Playdar.Util.loadjs(this.get_url("resolve","handle_resolution",_21));
}
}else{
this.listeners.onResolveIdle();
}
},cancel_resolve:function(){
this.initialise_resolve();
this.listeners.onCancelResolve();
if(Playdar.status_bar){
Playdar.status_bar.cancel_resolve();
}
},initialise_resolve:function(){
this.resolution_queue=[];
this.resolutions_in_progress={count:0,queries:{}};
},recheck_results:function(qid){
var _22={qid:qid};
this.resolutions_in_progress.queries[qid]=_22;
this.resolutions_in_progress.count++;
this.handle_resolution(_22);
},handle_resolution:function(_23){
if(this.resolutions_in_progress.queries[_23.qid]){
this.last_qid=_23.qid;
this.resolve_qids.push(this.last_qid);
this.get_results(_23.qid);
}
},get_results:function(qid){
if(this.resolutions_in_progress.queries[qid]){
if(!this.poll_counts[qid]){
this.poll_counts[qid]=0;
}
this.poll_counts[qid]++;
Playdar.Util.loadjs(this.get_url("get_results","handle_results",{qid:qid,poll:this.poll_counts[qid]}));
}
},poll_results:function(_24,_25,_26){
var _27=this.should_stop_polling(_24);
_26=_26||this;
if(!_27){
setTimeout(function(){
_25.call(_26,_24.qid);
},_24.poll_interval||_24.refresh_interval);
}
return _27;
},should_stop_polling:function(_28){
if(_28.poll_interval<=0||_28.refresh_interval<=0){
return true;
}
if(_28.solved===true){
return true;
}
if(this.poll_counts[_28.qid]>=(_28.poll_limit||Playdar.MAX_POLLS)){
return true;
}
return false;
},handle_results:function(_29){
if(this.resolutions_in_progress.queries[_29.qid]){
var _2a=this.poll_results(_29,this.get_results);
if(Playdar.status_bar){
Playdar.status_bar.handle_results(_29,_2a);
}
if(this.results_handlers[_29.qid]){
this.results_handlers[_29.qid](_29,_2a);
}else{
this.listeners.onResults(_29,_2a);
}
if(_2a){
delete this.resolutions_in_progress.queries[_29.qid];
this.resolutions_in_progress.count--;
this.process_resolution_queue();
}
}
},get_last_results:function(){
if(this.last_qid){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.get_results(this.last_qid);
}
},get_base_url:function(_2b,_2c){
var url="http://"+Playdar.SERVER_ROOT+":"+Playdar.SERVER_PORT;
if(_2b){
url+=_2b;
}
if(_2c){
url+="?"+Playdar.Util.toQueryString(_2c);
}
return url;
},get_url:function(_2d,_2e,_2f){
_2f=_2f||{};
_2f.call_id=new Date().getTime();
_2f.method=_2d;
if(!_2f.jsonp){
if(_2e.join){
_2f.jsonp=_2e.join(".");
}else{
_2f.jsonp=this.jsonp_callback(_2e);
}
}
this.add_auth_token(_2f);
return this.get_base_url("/api/",_2f);
},add_auth_token:function(_30){
if(this.is_authed()){
_30.auth=this.auth_token;
}
return _30;
},get_stream_url:function(sid){
return this.get_base_url("/sid/"+sid);
},jsonp_callback:function(_31){
return "Playdar.client."+_31;
},list_results:function(_32){
for(var i=0;i<_32.results.length;i++){
console.log(_32.results[i].name);
}
}};
Playdar.Scrobbler=function(){
Playdar.scrobbler=this;
};
Playdar.Scrobbler.prototype={get_url:function(_33,_34){
_34=_34||{};
_34.call_id=new Date().getTime();
_34.jsonp=_34.jsonp||"Playdar.nop";
Playdar.client.add_auth_token(_34);
return Playdar.client.get_base_url("/audioscrobbler/"+_33,_34);
},start:function(_35,_36,_37,_38,_39,_3a){
var _3b={a:_35,t:_36,o:"P"};
if(_37){
_3b["b"]=_37;
}
if(_38){
_3b["l"]=_38;
}
if(_39){
_3b["n"]=_39;
}
if(_3a){
_3b["m"]=_3a;
}
Playdar.Util.loadjs(this.get_url("start",_3b));
},stop:function(){
Playdar.Util.loadjs(this.get_url("stop"));
},pause:function(){
Playdar.Util.loadjs(this.get_url("pause"));
},resume:function(){
Playdar.Util.loadjs(this.get_url("resume"));
},get_sound_callbacks:function(_3c){
var _3d=this;
return {onload:function(){
if(this.readyState==2){
_3d.stop();
this.unload();
}
},onplay:function(){
this.scrobbleStart=true;
},onpause:function(){
_3d.pause();
},onresume:function(){
_3d.resume();
},onfinish:function(){
if(!this.chained){
_3d.stop();
}
},whileplaying:function(){
if(this.scrobbleStart){
this.scrobbleStart=false;
_3d.start(_3c.artist,_3c.track,_3c.album,_3c.duration);
}
}};
}};
Playdar.Player=function(_3e){
Playdar.player=this;
this.streams={};
this.nowplayingid=null;
this.soundmanager=_3e;
};
Playdar.Player.MIMETYPES={"audio/mpeg":false,"audio/aac":true,"audio/x-aac":true,"audio/flv":true,"audio/mov":true,"audio/mp4":true,"audio/m4v":true,"audio/f4v":true,"audio/m4a":true,"audio/x-m4a":true,"audio/x-m4b":true,"audio/mp4v":true,"audio/3gp":true,"audio/3g2":true};
Playdar.Player.prototype={get_mime_types:function(){
var _3f=[];
for(var _40 in Playdar.Player.MIMETYPES){
_3f.push(_40);
}
return _3f;
},register_stream:function(_41,_42){
if(this.streams[_41.sid]){
return false;
}
this.streams[_41.sid]=_41;
var _43=Playdar.Util.extend_object({id:"s_"+_41.sid,url:Playdar.client.get_stream_url(_41.sid),isMovieStar:Playdar.Player.MIMETYPES[_41.mimetype]===true,bufferTime:2},_42);
var _44=[_42];
if(Playdar.status_bar){
_44.push(Playdar.status_bar.get_sound_callbacks(_41));
}
if(Playdar.scrobbler){
_44.push(Playdar.scrobbler.get_sound_callbacks(_41));
}
Playdar.Util.extend_object(_43,Playdar.Util.merge_callback_options(_44));
try{
var _45=this.soundmanager.createSound(_43);
}
catch(e){
return false;
}
return _45;
},play_stream:function(sid){
var _46=this.soundmanager.getSoundById("s_"+sid);
if(this.nowplayingid!=sid){
this.stop_current();
if(_46.playState===0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_46.togglePause();
return _46;
},stop_current:function(_47){
if(_47){
if(Playdar.scrobbler){
Playdar.scrobbler.stop();
}
}
if(this.nowplayingid){
var _48=this.soundmanager.getSoundById("s_"+this.nowplayingid);
if(_48.playState==1){
_48.setPosition(1);
_48.stop();
}
this.nowplayingid=null;
}
if(Playdar.status_bar){
Playdar.status_bar.stop_current();
}
},stop_stream:function(sid){
if(sid&&sid==this.nowplayingid){
this.stop_current();
return true;
}
return false;
},is_now_playing:function(){
if(this.nowplayingid){
return true;
}
return false;
},toggle_nowplaying:function(){
if(this.nowplayingid){
this.play_stream(this.nowplayingid);
}
}};
Playdar.StatusBar=function(){
Playdar.status_bar=this;
this.queries_popup=null;
this.progress_bar_width=200;
this.request_count=0;
this.pending_count=0;
this.success_count=0;
this.query_list_link=null;
this.nowplaying_query_button=null;
this.build();
};
Playdar.StatusBar.prototype={build:function(){
var _49=document.createElement("div");
_49.style.position="fixed";
_49.style.bottom=0;
_49.style.left=0;
_49.style.zIndex=100;
_49.style.width="100%";
_49.style.height="36px";
_49.style.padding="7px 0";
_49.style.borderTop="2px solid #4c7a0f";
_49.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_49.style.color="#335507";
_49.style.background="#e8f9bb";
var _4a=document.createElement("div");
_4a.style.padding="0 7px";
var _4b="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_4a.innerHTML=_4b;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_4a.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _4c=document.createElement("p");
_4c.style.margin="0";
this.track_link=document.createElement("a");
this.track_link.style.textDecoration="none";
this.artist_name=document.createElement("span");
this.artist_name.style.textTransform="uppercase";
this.artist_name.style.color="#4c7a0f";
this.track_name=document.createElement("strong");
this.track_name.style.margin="0 0 0 10px";
this.track_name.style.color="#335507";
this.track_link.appendChild(this.artist_name);
this.track_link.appendChild(this.track_name);
_4c.appendChild(this.track_link);
this.playback.appendChild(_4c);
var _4d=document.createElement("table");
_4d.setAttribute("cellpadding",0);
_4d.setAttribute("cellspacing",0);
_4d.setAttribute("border",0);
_4d.style.color="#4c7a0f";
_4d.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _4e=document.createElement("tbody");
var _4f=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_4f.appendChild(this.track_elapsed);
var _50=document.createElement("td");
_50.style.padding="0 5px";
_50.style.verticalAlign="middle";
var _51=document.createElement("div");
_51.style.width=this.progress_bar_width+"px";
_51.style.height="9px";
_51.style.border="1px solid #4c7a0f";
_51.style.background="#fff";
_51.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_51.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_51.appendChild(this.playhead);
_51.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_50.appendChild(_51);
_4f.appendChild(_50);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_4f.appendChild(this.track_duration);
_4e.appendChild(_4f);
_4d.appendChild(_4e);
this.playback.appendChild(_4d);
_4a.appendChild(this.playback);
var _52=document.createElement("div");
_52.style.cssFloat="right";
_52.style.padding="0 8px";
_52.style.textAlign="right";
var _53=document.createElement("p");
_53.style.margin=0;
_53.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_52.appendChild(_53);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML=Playdar.client.get_disconnect_link_html();
_52.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_49.appendChild(_52);
_49.appendChild(_4a);
document.body.appendChild(_49);
var _54=document.body.style.marginBottom;
if(!_54){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_54=css.marginBottom;
}
}
document.body.style.marginBottom=(_54.replace("px","")-0)+36+(7*2)+2+"px";
return _49;
},ready:function(){
this.playdar_links.style.display="";
var _55="Ready";
this.status.innerHTML=_55;
},offline:function(){
this.playdar_links.style.display="none";
var _56=Playdar.client.get_auth_link_html();
this.status.innerHTML=_56;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _57="manualAuth_"+Playdar.client.uuid;
var _58="<form>"+"<input type=\"text\" id=\""+_57+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_57+"'); return false;"+"\" />"+"</form>";
this.status.innerHTML=_58;
Playdar.Util.select("#"+_57)[0].focus();
},handle_stat:function(_59){
if(_59.authenticated){
this.ready();
}else{
this.offline();
}
},show_resolution_status:function(){
if(this.query_count){
var _5a=" ";
if(this.pending_count){
_5a+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_5a+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_5a;
}
},handle_results:function(_5b,_5c){
if(_5c){
this.pending_count--;
if(_5b.results.length){
this.success_count++;
}
}
this.show_resolution_status();
},increment_requests:function(){
this.request_count++;
this.pending_count++;
this.show_resolution_status();
},cancel_resolve:function(){
this.pending_count=0;
this.show_resolution_status();
},get_sound_callbacks:function(_5d){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
}};
},play_handler:function(_5e){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_5e.sid);
this.track_link.title=_5e.source;
this.track_name.innerHTML=_5e.track;
this.artist_name.innerHTML=_5e.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_5e.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_5f){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_5f.position/1000));
var _60;
if(_5f.readyState==3){
_60=_5f.duration;
}else{
_60=_5f.durationEstimate;
}
var _61=_5f.position/_60;
this.playhead.style.width=Math.round(_61*this.progress_bar_width)+"px";
this.loading_handler(_5f);
},loading_handler:function(_62){
var _63=_62.bytesLoaded/_62.bytesTotal;
this.bufferhead.style.width=Math.round(_63*this.progress_bar_width)+"px";
},stop_current:function(){
this.playback.style.display="none";
this.status.style.display="";
this.track_link.href="#";
this.track_link.title="";
this.track_name.innerHTML="";
this.artist_name.innerHTML="";
this.bufferhead.style.width=0;
this.playhead.style.width=0;
}};
Playdar.Util={generate_uuid:function(){
var _64="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _65=[];
var rnd=Math.random;
var r;
_65[8]=_65[13]=_65[18]=_65[23]="-";
_65[14]="4";
for(var i=0;i<36;i++){
if(!_65[i]){
r=0|rnd()*16;
_65[i]=_64[(i==19)?(r&3)|8:r&15];
}
}
return _65.join("");
},toQueryPair:function(key,_66){
if(_66===null){
return key;
}
return key+"="+encodeURIComponent(_66);
},toQueryString:function(_67){
var _68=[];
for(var key in _67){
var _69=_67[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_69)=="[object Array]"){
for(var i=0;i<_69.length;i++){
_68.push(Playdar.Util.toQueryPair(key,_69[i]));
}
}else{
_68.push(Playdar.Util.toQueryPair(key,_69));
}
}
return _68.join("&");
},mmss:function(_6a){
var s=_6a%60;
if(s<10){
s="0"+s;
}
return Math.floor(_6a/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_6b,_6c,_6d){
var _6e;
if(_6d){
var _6f=new Date();
_6f.setTime(_6f.getTime()+(_6d*24*60*60*1000));
_6e="; expires="+_6f.toGMTString();
}else{
_6e="";
}
document.cookie=_6b+"="+_6c+_6e+"; path=/";
},getcookie:function(_70){
var _71=_70+"=";
var _72=document.cookie.split(";");
for(var i=0;i<_72.length;i++){
var c=_72[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_71)===0){
return c.substring(_71.length,c.length);
}
}
return null;
},deletecookie:function(_73){
Playdar.Util.setcookie(_73,"",-1);
},get_window_position:function(){
var _74={};
if(window.screenLeft){
_74.x=window.screenLeft||0;
_74.y=window.screenTop||0;
}else{
_74.x=window.screenX||0;
_74.y=window.screenY||0;
}
return _74;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_75){
var _76=Playdar.Util.get_popup_location(_75);
return ["left="+_76.x,"top="+_76.y,"width="+_75.w,"height="+_75.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_77){
var _78=Playdar.Util.get_window_position();
var _79=Playdar.Util.get_window_size();
return {"x":Math.max(0,_78.x+(_79.w-_77.w)/2),"y":Math.max(0,_78.y+(_79.h-_77.h)/2)};
},addEvent:function(obj,_7a,fn){
if(obj.attachEvent){
obj["e"+_7a+fn]=fn;
obj[_7a+fn]=function(){
obj["e"+_7a+fn](window.event);
};
obj.attachEvent("on"+_7a,obj[_7a+fn]);
}else{
obj.addEventListener(_7a,fn,false);
}
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_7b,_7c){
_7c=_7c||{};
for(var _7d in _7c){
_7b[_7d]=_7c[_7d];
}
return _7b;
},merge_callback_options:function(_7e){
var _7f={};
var _80=[];
var i,_81,_82;
for(i=0;i<_7e.length;i++){
_81=_7e[i];
for(_82 in _81){
if(typeof (_81[_82])=="function"){
if(!_7f[_82]){
_80.push(_82);
_7f[_82]=[];
}
_7f[_82].push(_81);
}
}
}
var _83={};
for(i=0;i<_80.length;i++){
var key=_80[i];
_83[key]=(function(key,_84){
return function(){
for(var j=0;j<_84.length;j++){
_84[j][key].apply(this,arguments);
}
};
})(key,_7f[key]);
}
return _83;
},location_from_url:function(url){
var _85=document.createElement("a");
_85.href=url;
var _86={};
for(k in window.location){
if((typeof (window.location[k])==="string")){
_86[k]=_85[k];
}
}
return _86;
},log:function(_87){
if(typeof console!="undefined"){
console.dir(_87);
}
}};
Playdar.Parse={getProperty:function(_88,_89){
var _89=_89||"innerHTML";
var i,_8a,_8b;
for(i=0;i<_88.length;i++){
_8a=_88[i];
_8b=_8a[_89]||_8a.getAttribute(_89);
if(_8b){
return _8b;
}
}
return;
},getValue:function(_8c){
var i,_8d,_8e;
for(i=0;i<_8c.length;i++){
_8d=_8c[i];
_8e=Playdar.Util.select(".value",_8d);
if(_8e.length){
return Playdar.Parse.getContentWithoutValue(_8e);
}
}
return;
},getContentWithoutValue:function(_8f){
return Playdar.Parse.getProperty(_8f,"content")||Playdar.Parse.getProperty(_8f,"title")||Playdar.Parse.getProperty(_8f);
},getContent:function(_90){
var _91=Playdar.Parse.getValue(_90)||Playdar.Parse.getContentWithoutValue(_90);
if(_91){
return _91.replace(/(^\s*)|(\s*$)/g,"");
}
return;
},getPosition:function(_92){
var _93=_92;
var _94=0;
if(_92.nodeName=="LI"&&_92.parentNode.nodeName=="OL"){
while(_93.previousSibling){
_93=_93.previousSibling;
if(_93.nodeName=="LI"){
_94++;
}
}
return _94+1;
}
return;
},getNS:function(_95,url){
for(var i=0;i<_95.attributes.length;i++){
var _96=_95.attributes[i];
if(_96.nodeValue==url){
return _96.nodeName.replace("xmlns:","");
}
}
},getExc:function(_97,_98){
return ":not("+_97+" "+_98+")";
},microformats:function(_99){
var sel=Playdar.Util.select;
function _9a(_9b,_9c){
return sel(_9b+Playdar.Parse.getExc(".item",_9b),_9c);
};
function _9d(_9e,rec){
var _9f=rec?sel:_9a;
var _a0=Playdar.Parse.getProperty(_9f(".payment",_9e),"href")||Playdar.Parse.getProperty(_9f("[rel~=payment]",_9e),"href");
if(!_a0){
return;
}
return {url:_a0,currency:Playdar.Parse.getContent(_9f(".price .currency",_9e)),amount:Playdar.Parse.getContent(_9f(".price .amount",_9e))};
};
function _a1(_a2,_a3,_a4){
var _a5=[];
var i,_a6;
for(i=0;i<_a2.length;i++){
if(!_a2[i].playdarParsed){
_a6={title:Playdar.Parse.getContent(sel(".fn",_a2[i]))||Playdar.Parse.getContent(sel(".title",_a2[i])),artist:Playdar.Parse.getContent(sel(".contributor",_a2[i]))||_a3,album:_a4,position:Playdar.Parse.getContent(sel(".position",_a2[i]))||Playdar.Parse.getPosition(_a2[i]),duration:Playdar.Parse.getContent(sel(".duration",_a2[i])),buy:_9d(_a2[i],true),element:_a2[i]};
_a5.push(_a6);
_a2[i].playdarParsed=true;
}
}
return _a5;
};
function _a7(_a8){
var _a9=_9a(".contributor",_a8);
var _aa=Playdar.Parse.getContent(sel(".fn",_a9[0]));
if(!_aa){
_aa=Playdar.Parse.getContent(_a9);
}
return _aa;
};
function _ab(_ac){
var _ad=[];
var _ae=sel(".haudio",_ac);
var i,_af,_b0,_b1,_b2,_b3,_b4,_b5;
for(i=0;i<_ae.length;i++){
if(!_ae[i].playdarParsed){
_af=Playdar.Parse.getContent(_9a(".album",_ae[i]));
if(!_af){
continue;
}
_b0=_a7(_ae[i]);
if(!_b0){
continue;
}
_b1=_a1(sel(".item",_ae[i]),_b0,_af);
if(!_b1.length){
continue;
}
_ad.push({type:"album",title:_af,artist:_b0,tracks:_b1,image:Playdar.Parse.getProperty(_9a(".photo",_ae[i]),"src")||Playdar.Parse.getProperty(_9a(".photo",_ae[i]),"href"),download:Playdar.Parse.getProperty(_9a("[rel~=enclosure]",_ae[i]),"href"),released:Playdar.Parse.getContent(_9a(".published",_ae[i])),duration:Playdar.Parse.getContent(_9a(".duration",_ae[i])),buy:_9d(_ae[i])});
_ae[i].playdarParsed=true;
}
}
return _ad;
};
function _b6(_b7){
var _b8=_ab(_b7);
var _b9=_a1(sel(".haudio"));
if(_b9.length){
_b8.push({type:"page",title:window.document.title||window.location.href,tracks:_b9});
}
return _b8;
};
var _ba=_b6(_99);
return _ba;
},rdfa:function(_bb){
var sel=Playdar.Util.select;
var _bc=sel("html")[0];
var _bd=Playdar.Parse.getNS(_bc,"http://purl.org/commerce#");
var _be=Playdar.Parse.getNS(_bc,"http://purl.org/media/audio#");
var _bf=Playdar.Parse.getNS(_bc,"http://purl.org/media#");
var _c0=Playdar.Parse.getNS(_bc,"http://purl.org/dc/terms/")||Playdar.Parse.getNS(_bc,"http://purl.org/dc/elements/1.1/");
var _c1=Playdar.Parse.getNS(_bc,"http://xmlns.com/foaf/0.1/");
var _c2=Playdar.Parse.getNS(_bc,"http://purl.org/ontology/mo/");
function _c3(_c4,_c5){
var _c6=_c4;
if(_be){
_c6+=Playdar.Parse.getExc("[typeof="+_be+":Recording]",_c4);
}
if(_c2){
_c6+=Playdar.Parse.getExc("[typeof="+_c2+":Track]",_c4);
}
return sel(_c6,_c5);
};
if(!_be&&!_c2){
return [];
}
function _c7(_c8,rec){
var _c9=rec?sel:_c3;
var _ca=Playdar.Parse.getProperty(_c9("[rel~="+_bd+":payment]",_c8),"href");
if(!_ca){
return;
}
return {url:_ca,currency:Playdar.Parse.getContent(_c9("[rel~="+_bd+":costs] [property="+_bd+":currency]",_c8)),amount:Playdar.Parse.getContent(_c9("[rel~="+_bd+":costs] [property="+_bd+":amount]",_c8))};
};
function _cb(_cc,_cd,_ce){
var _cf=[];
var _d0=[];
if(_be){
_d0.push("[typeof="+_be+":Recording]");
}
if(_c2){
_d0.push("[typeof="+_c2+":Track]");
}
var _d1=_c3(_d0.join(","),_cc);
var i,_d2;
for(i=0;i<_d1.length;i++){
if(!_d1[i].playdarParsed){
_d2={title:Playdar.Parse.getContent(sel("[property="+_c0+":title]",_d1[i])),artist:Playdar.Parse.getContent(sel("[property="+_c0+":creator], [rel~="+_c1+":maker] [property="+_c1+":name]",_d1[i]))||_cd,album:Playdar.Parse.getContent(sel("[typeof="+_c2+":Record] [property="+_c0+":title]"))||_ce,position:Playdar.Parse.getContent(sel("[property="+_bf+":position]",_d1[i]))||Playdar.Parse.getPosition(_d1[i]),duration:Playdar.Parse.getContent(sel("[property="+_bf+":duration]",_d1[i]))||Playdar.Parse.getContent(sel("[property="+_c0+":duration]",_d1[i])),buy:_c7(_d1[i],true),element:_d1[i]};
_cf.push(_d2);
_d1[i].playdarParsed=true;
}
}
return _cf;
};
function _d3(_d4){
var _d5=_c3("[property="+_c0+":creator]",_d4);
if(!_d5.length){
_d5=_c3("[rel~="+_c1+":maker]",_d4);
}
var _d6;
if(_d5.length){
_d6=Playdar.Parse.getContent(sel("[property="+_c1+":name]",_d5[0]));
}
if(!_d6){
var _d7=sel("[rel~="+_c0+":creator]",_d4);
var _d8=Playdar.Parse.getProperty(_d7,"resource");
if(_d8){
var _d9=sel("[about="+_d8+"]");
_d6=Playdar.Parse.getContent(sel("[property="+_c1+":name]",_d9[0]))||Playdar.Parse.getContent(_d9);
}
}
if(!_d6){
_d6=Playdar.Parse.getContent(_d5);
}
return _d6;
};
function _da(_db){
var _dc=[];
var _dd=sel("[typeof="+_be+":Album], [typeof="+_c2+":Record]",_db);
var i,_de,_df,_e0,_e1;
for(i=0;i<_dd.length;i++){
if(!_dd[i].playdarParsed){
_df=Playdar.Parse.getContent(_c3("[property="+_c0+":title]",_dd[i]));
if(!_df){
continue;
}
_e0=_d3(_dd[i]);
if(!_e0){
continue;
}
_e1=_cb(_dd[i],_e0,_df);
if(!_e1.length){
continue;
}
_dc.push({type:"album",title:_df,artist:_e0,tracks:_e1,image:Playdar.Parse.getProperty(_c3("[rel~="+_bf+":depiction]",_dd[i]),"src")||Playdar.Parse.getProperty(_c3("[rev~="+_bf+":depiction]",_dd[i]),"src"),download:Playdar.Parse.getProperty(_c3("[rel~="+_bf+":download]",_dd[i]),"href"),released:Playdar.Parse.getContent(_c3("[property="+_c0+":issued]",_dd[i]))||Playdar.Parse.getContent(_c3("[property="+_c0+":published]",_dd[i]))||Playdar.Parse.getContent(_c3("[property="+_c0+":date]",_dd[i])),duration:Playdar.Parse.getContent(_c3("[property="+_bf+":duration]",_dd[i]))||Playdar.Parse.getContent(_c3("[property="+_c0+":duration]",_dd[i])),buy:_c7(_dd[i])});
_dd[i].playdarParsed=true;
}
}
return _dc;
};
function _e2(_e3){
var _e4=_da(_e3);
var _e5=_cb(_e3);
if(_e5.length){
_e4.push({type:"page",title:window.document.title||window.location.href,tracks:_e5});
}
return _e4;
};
var _e6=_e2(_bb);
return _e6;
}};
Playdar.Util.addEvent(window,"beforeunload",Playdar.unload);
(function(){
var _e7=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_e8=0,_e9=Object.prototype.toString,_ea=false;
var _eb=function(_ec,_ed,_ee,_ef){
_ee=_ee||[];
var _f0=_ed=_ed||document;
if(_ed.nodeType!==1&&_ed.nodeType!==9){
return [];
}
if(!_ec||typeof _ec!=="string"){
return _ee;
}
var _f1=[],m,set,_f2,_f3,_f4,_f5,_f6=true,_f7=_f8(_ed);
_e7.lastIndex=0;
while((m=_e7.exec(_ec))!==null){
_f1.push(m[1]);
if(m[2]){
_f5=RegExp.rightContext;
break;
}
}
if(_f1.length>1&&_f9.exec(_ec)){
if(_f1.length===2&&_fa.relative[_f1[0]]){
set=_fb(_f1[0]+_f1[1],_ed);
}else{
set=_fa.relative[_f1[0]]?[_ed]:_eb(_f1.shift(),_ed);
while(_f1.length){
_ec=_f1.shift();
if(_fa.relative[_ec]){
_ec+=_f1.shift();
}
set=_fb(_ec,set);
}
}
}else{
if(!_ef&&_f1.length>1&&_ed.nodeType===9&&!_f7&&_fa.match.ID.test(_f1[0])&&!_fa.match.ID.test(_f1[_f1.length-1])){
var ret=_eb.find(_f1.shift(),_ed,_f7);
_ed=ret.expr?_eb.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_ed){
var ret=_ef?{expr:_f1.pop(),set:_fc(_ef)}:_eb.find(_f1.pop(),_f1.length===1&&(_f1[0]==="~"||_f1[0]==="+")&&_ed.parentNode?_ed.parentNode:_ed,_f7);
set=ret.expr?_eb.filter(ret.expr,ret.set):ret.set;
if(_f1.length>0){
_f2=_fc(set);
}else{
_f6=false;
}
while(_f1.length){
var cur=_f1.pop(),pop=cur;
if(!_fa.relative[cur]){
cur="";
}else{
pop=_f1.pop();
}
if(pop==null){
pop=_ed;
}
_fa.relative[cur](_f2,pop,_f7);
}
}else{
_f2=_f1=[];
}
}
if(!_f2){
_f2=set;
}
if(!_f2){
throw "Syntax error, unrecognized expression: "+(cur||_ec);
}
if(_e9.call(_f2)==="[object Array]"){
if(!_f6){
_ee.push.apply(_ee,_f2);
}else{
if(_ed&&_ed.nodeType===1){
for(var i=0;_f2[i]!=null;i++){
if(_f2[i]&&(_f2[i]===true||_f2[i].nodeType===1&&_fd(_ed,_f2[i]))){
_ee.push(set[i]);
}
}
}else{
for(var i=0;_f2[i]!=null;i++){
if(_f2[i]&&_f2[i].nodeType===1){
_ee.push(set[i]);
}
}
}
}
}else{
_fc(_f2,_ee);
}
if(_f5){
_eb(_f5,_f0,_ee,_ef);
_eb.uniqueSort(_ee);
}
return _ee;
};
_eb.uniqueSort=function(_fe){
if(_ff){
_ea=false;
_fe.sort(_ff);
if(_ea){
for(var i=1;i<_fe.length;i++){
if(_fe[i]===_fe[i-1]){
_fe.splice(i--,1);
}
}
}
}
};
_eb.matches=function(expr,set){
return _eb(expr,null,null,set);
};
_eb.find=function(expr,_100,_101){
var set,_102;
if(!expr){
return [];
}
for(var i=0,l=_fa.order.length;i<l;i++){
var type=_fa.order[i],_102;
if((_102=_fa.match[type].exec(expr))){
var left=RegExp.leftContext;
if(left.substr(left.length-1)!=="\\"){
_102[1]=(_102[1]||"").replace(/\\/g,"");
set=_fa.find[type](_102,_100,_101);
if(set!=null){
expr=expr.replace(_fa.match[type],"");
break;
}
}
}
}
if(!set){
set=_100.getElementsByTagName("*");
}
return {set:set,expr:expr};
};
_eb.filter=function(expr,set,_103,not){
var old=expr,_104=[],_105=set,_106,_107,_108=set&&set[0]&&_f8(set[0]);
while(expr&&set.length){
for(var type in _fa.filter){
if((_106=_fa.match[type].exec(expr))!=null){
var _109=_fa.filter[type],_10a,item;
_107=false;
if(_105==_104){
_104=[];
}
if(_fa.preFilter[type]){
_106=_fa.preFilter[type](_106,_105,_103,_104,not,_108);
if(!_106){
_107=_10a=true;
}else{
if(_106===true){
continue;
}
}
}
if(_106){
for(var i=0;(item=_105[i])!=null;i++){
if(item){
_10a=_109(item,_106,i,_105);
var pass=not^!!_10a;
if(_103&&_10a!=null){
if(pass){
_107=true;
}else{
_105[i]=false;
}
}else{
if(pass){
_104.push(item);
_107=true;
}
}
}
}
}
if(_10a!==undefined){
if(!_103){
_105=_104;
}
expr=expr.replace(_fa.match[type],"");
if(!_107){
return [];
}
break;
}
}
}
if(expr==old){
if(_107==null){
throw "Syntax error, unrecognized expression: "+expr;
}else{
break;
}
}
old=expr;
}
return _105;
};
var _fa=_eb.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(elem){
return elem.getAttribute("href");
}},relative:{"+":function(_10b,part,_10c){
var _10d=typeof part==="string",_10e=_10d&&!(/\W/).test(part),_10f=_10d&&!_10e;
if(_10e&&!_10c){
part=part.toUpperCase();
}
for(var i=0,l=_10b.length,elem;i<l;i++){
if((elem=_10b[i])){
while((elem=elem.previousSibling)&&elem.nodeType!==1){
}
_10b[i]=_10f||elem&&elem.nodeName===part?elem||false:elem===part;
}
}
if(_10f){
_eb.filter(part,_10b,true);
}
},">":function(_110,part,_111){
var _112=typeof part==="string";
if(_112&&!(/\W/).test(part)){
part=_111?part:part.toUpperCase();
for(var i=0,l=_110.length;i<l;i++){
var elem=_110[i];
if(elem){
var _113=elem.parentNode;
_110[i]=_113.nodeName===part?_113:false;
}
}
}else{
for(var i=0,l=_110.length;i<l;i++){
var elem=_110[i];
if(elem){
_110[i]=_112?elem.parentNode:elem.parentNode===part;
}
}
if(_112){
_eb.filter(part,_110,true);
}
}
},"":function(_114,part,_115){
var _116=_e8++,_117=_118;
if(!part.match(/\W/)){
var _119=part=_115?part:part.toUpperCase();
_117=_11a;
}
_117("parentNode",part,_116,_114,_119,_115);
},"~":function(_11b,part,_11c){
var _11d=_e8++,_11e=_118;
if(typeof part==="string"&&!part.match(/\W/)){
var _11f=part=_11c?part:part.toUpperCase();
_11e=_11a;
}
_11e("previousSibling",part,_11d,_11b,_11f,_11c);
}},find:{ID:function(_120,_121,_122){
if(typeof _121.getElementById!=="undefined"&&!_122){
var m=_121.getElementById(_120[1]);
return m?[m]:[];
}
},NAME:function(_123,_124,_125){
if(typeof _124.getElementsByName!=="undefined"){
var ret=[],_126=_124.getElementsByName(_123[1]);
for(var i=0,l=_126.length;i<l;i++){
if(_126[i].getAttribute("name")===_123[1]){
ret.push(_126[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_127,_128){
return _128.getElementsByTagName(_127[1]);
}},preFilter:{CLASS:function(_129,_12a,_12b,_12c,not,_12d){
_129=" "+_129[1].replace(/\\/g,"")+" ";
if(_12d){
return _129;
}
for(var i=0,elem;(elem=_12a[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_129)>=0)){
if(!_12b){
_12c.push(elem);
}
}else{
if(_12b){
_12a[i]=false;
}
}
}
}
return false;
},ID:function(_12e){
return _12e[1].replace(/\\/g,"");
},TAG:function(_12f,_130){
for(var i=0;_130[i]===false;i++){
}
return _130[i]&&_f8(_130[i])?_12f[1]:_12f[1].toUpperCase();
},CHILD:function(_131){
if(_131[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_131[2]=="even"&&"2n"||_131[2]=="odd"&&"2n+1"||!(/\D/).test(_131[2])&&"0n+"+_131[2]||_131[2]);
_131[2]=(test[1]+(test[2]||1))-0;
_131[3]=test[3]-0;
}
_131[0]=_e8++;
return _131;
},ATTR:function(_132,_133,_134,_135,not,_136){
var name=_132[1].replace(/\\/g,"");
if(!_136&&_fa.attrMap[name]){
_132[1]=_fa.attrMap[name];
}
if(_132[2]==="~="){
_132[4]=" "+_132[4]+" ";
}
return _132;
},PSEUDO:function(_137,_138,_139,_13a,not){
if(_137[1]==="not"){
if(_137[3].match(_e7).length>1||(/^\w/).test(_137[3])){
_137[3]=_eb(_137[3],null,null,_138);
}else{
var ret=_eb.filter(_137[3],_138,_139,true^not);
if(!_139){
_13a.push.apply(_13a,ret);
}
return false;
}
}else{
if(_fa.match.POS.test(_137[0])||_fa.match.CHILD.test(_137[0])){
return true;
}
}
return _137;
},POS:function(_13b){
_13b.unshift(true);
return _13b;
}},filters:{enabled:function(elem){
return elem.disabled===false&&elem.type!=="hidden";
},disabled:function(elem){
return elem.disabled===true;
},checked:function(elem){
return elem.checked===true;
},selected:function(elem){
elem.parentNode.selectedIndex;
return elem.selected===true;
},parent:function(elem){
return !!elem.firstChild;
},empty:function(elem){
return !elem.firstChild;
},has:function(elem,i,_13c){
return !!_eb(_13c[3],elem).length;
},header:function(elem){
return (/h\d/i).test(elem.nodeName);
},text:function(elem){
return "text"===elem.type;
},radio:function(elem){
return "radio"===elem.type;
},checkbox:function(elem){
return "checkbox"===elem.type;
},file:function(elem){
return "file"===elem.type;
},password:function(elem){
return "password"===elem.type;
},submit:function(elem){
return "submit"===elem.type;
},image:function(elem){
return "image"===elem.type;
},reset:function(elem){
return "reset"===elem.type;
},button:function(elem){
return "button"===elem.type||elem.nodeName.toUpperCase()==="BUTTON";
},input:function(elem){
return (/input|select|textarea|button/i).test(elem.nodeName);
}},setFilters:{first:function(elem,i){
return i===0;
},last:function(elem,i,_13d,_13e){
return i===_13e.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_13f){
return i<_13f[3]-0;
},gt:function(elem,i,_140){
return i>_140[3]-0;
},nth:function(elem,i,_141){
return _141[3]-0==i;
},eq:function(elem,i,_142){
return _142[3]-0==i;
}},filter:{PSEUDO:function(elem,_143,i,_144){
var name=_143[1],_145=_fa.filters[name];
if(_145){
return _145(elem,i,_143,_144);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_143[3])>=0;
}else{
if(name==="not"){
var not=_143[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_146){
var type=_146[1],node=elem;
switch(type){
case "only":
case "first":
while(node=node.previousSibling){
if(node.nodeType===1){
return false;
}
}
if(type=="first"){
return true;
}
node=elem;
case "last":
while(node=node.nextSibling){
if(node.nodeType===1){
return false;
}
}
return true;
case "nth":
var _147=_146[2],last=_146[3];
if(_147==1&&last==0){
return true;
}
var _148=_146[0],_149=elem.parentNode;
if(_149&&(_149.sizcache!==_148||!elem.nodeIndex)){
var _14a=0;
for(node=_149.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_14a;
}
}
_149.sizcache=_148;
}
var diff=elem.nodeIndex-last;
if(_147==0){
return diff==0;
}else{
return (diff%_147==0&&diff/_147>=0);
}
}
},ID:function(elem,_14b){
return elem.nodeType===1&&elem.getAttribute("id")===_14b;
},TAG:function(elem,_14c){
return (_14c==="*"&&elem.nodeType===1)||elem.nodeName===_14c;
},CLASS:function(elem,_14d){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_14d)>-1;
},ATTR:function(elem,_14e){
var name=_14e[1],_14f=_fa.attrHandle[name]?_fa.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_150=_14f+"",type=_14e[2],_151=_14e[4];
return _14f==null?type==="!=":type==="="?_150===_151:type==="*="?_150.indexOf(_151)>=0:type==="~="?(" "+_150+" ").indexOf(_151)>=0:!_151?_150&&_14f!==false:type==="!="?_150!=_151:type==="^="?_150.indexOf(_151)===0:type==="$="?_150.substr(_150.length-_151.length)===_151:type==="|="?_150===_151||_150.substr(0,_151.length+1)===_151+"-":false;
},POS:function(elem,_152,i,_153){
var name=_152[2],_154=_fa.setFilters[name];
if(_154){
return _154(elem,i,_152,_153);
}
}}};
var _f9=_fa.match.POS;
for(var type in _fa.match){
_fa.match[type]=new RegExp(_fa.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _fc=function(_155,_156){
_155=Array.prototype.slice.call(_155);
if(_156){
_156.push.apply(_156,_155);
return _156;
}
return _155;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_fc=function(_157,_158){
var ret=_158||[];
if(_e9.call(_157)==="[object Array]"){
Array.prototype.push.apply(ret,_157);
}else{
if(typeof _157.length==="number"){
for(var i=0,l=_157.length;i<l;i++){
ret.push(_157[i]);
}
}else{
for(var i=0;_157[i];i++){
ret.push(_157[i]);
}
}
}
return ret;
};
}
var _ff;
if(document.documentElement.compareDocumentPosition){
_ff=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_ea=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_ff=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_ea=true;
}
return ret;
};
}else{
if(document.createRange){
_ff=function(a,b){
var _159=a.ownerDocument.createRange(),_15a=b.ownerDocument.createRange();
_159.selectNode(a);
_159.collapse(true);
_15a.selectNode(b);
_15a.collapse(true);
var ret=_159.compareBoundaryPoints(Range.START_TO_END,_15a);
if(ret===0){
_ea=true;
}
return ret;
};
}
}
}
(function(){
var form=document.createElement("div"),id="script"+(new Date).getTime();
form.innerHTML="<a name='"+id+"'/>";
var root=document.documentElement;
root.insertBefore(form,root.firstChild);
if(!!document.getElementById(id)){
_fa.find.ID=function(_15b,_15c,_15d){
if(typeof _15c.getElementById!=="undefined"&&!_15d){
var m=_15c.getElementById(_15b[1]);
return m?m.id===_15b[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_15b[1]?[m]:undefined:[];
}
};
_fa.filter.ID=function(elem,_15e){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_15e;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_fa.find.TAG=function(_15f,_160){
var _161=_160.getElementsByTagName(_15f[1]);
if(_15f[1]==="*"){
var tmp=[];
for(var i=0;_161[i];i++){
if(_161[i].nodeType===1){
tmp.push(_161[i]);
}
}
_161=tmp;
}
return _161;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_fa.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _162=_eb,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_eb=function(_163,_164,_165,seed){
_164=_164||document;
if(!seed&&_164.nodeType===9&&!_f8(_164)){
try{
return _fc(_164.querySelectorAll(_163),_165);
}
catch(e){
}
}
return _162(_163,_164,_165,seed);
};
for(var prop in _162){
_eb[prop]=_162[prop];
}
})();
}
if(document.getElementsByClassName&&document.documentElement.getElementsByClassName){
(function(){
var div=document.createElement("div");
div.innerHTML="<div class='test e'></div><div class='test'></div>";
if(div.getElementsByClassName("e").length===0){
return;
}
div.lastChild.className="e";
if(div.getElementsByClassName("e").length===1){
return;
}
_fa.order.splice(1,0,"CLASS");
_fa.find.CLASS=function(_166,_167,_168){
if(typeof _167.getElementsByClassName!=="undefined"&&!_168){
return _167.getElementsByClassName(_166[1]);
}
};
})();
}
function _11a(dir,cur,_169,_16a,_16b,_16c){
var _16d=dir=="previousSibling"&&!_16c;
for(var i=0,l=_16a.length;i<l;i++){
var elem=_16a[i];
if(elem){
if(_16d&&elem.nodeType===1){
elem.sizcache=_169;
elem.sizset=i;
}
elem=elem[dir];
var _16e=false;
while(elem){
if(elem.sizcache===_169){
_16e=_16a[elem.sizset];
break;
}
if(elem.nodeType===1&&!_16c){
elem.sizcache=_169;
elem.sizset=i;
}
if(elem.nodeName===cur){
_16e=elem;
break;
}
elem=elem[dir];
}
_16a[i]=_16e;
}
}
};
function _118(dir,cur,_16f,_170,_171,_172){
var _173=dir=="previousSibling"&&!_172;
for(var i=0,l=_170.length;i<l;i++){
var elem=_170[i];
if(elem){
if(_173&&elem.nodeType===1){
elem.sizcache=_16f;
elem.sizset=i;
}
elem=elem[dir];
var _174=false;
while(elem){
if(elem.sizcache===_16f){
_174=_170[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_172){
elem.sizcache=_16f;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_174=true;
break;
}
}else{
if(_eb.filter(cur,[elem]).length>0){
_174=elem;
break;
}
}
}
elem=elem[dir];
}
_170[i]=_174;
}
}
};
var _fd=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _f8=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _fb=function(_175,_176){
var _177=[],_178="",_179,root=_176.nodeType?[_176]:_176;
while((_179=_fa.match.PSEUDO.exec(_175))){
_178+=_179[0];
_175=_175.replace(_fa.match.PSEUDO,"");
}
_175=_fa.relative[_175]?_175+"*":_175;
for(var i=0,l=root.length;i<l;i++){
_eb(_175,root[i],_177);
}
return _eb.filter(_178,_177);
};
Playdar.Util.select=_eb;
})();
