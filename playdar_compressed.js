Playdar={VERSION:"0.5.0",SERVER_ROOT:"localhost",SERVER_PORT:"60210",STATIC_HOST:"http://www.playdar.org",STAT_TIMEOUT:2000,AUTH_COOKIE_NAME:"Playdar.Auth",AUTH_POPUP_NAME:"Playdar.AuthPopup",AUTH_POPUP_SIZE:{"w":500,"h":260},QUERIES_POPUP_NAME:"Playdar.QueriesPopup",QUERIES_POPUP_SIZE:{"w":640,"h":700},MAX_POLLS:4,MAX_CONCURRENT_RESOLUTIONS:5,USE_STATUS_BAR:true,USE_SCROBBLER:true,client:null,status_bar:null,player:null,auth_details:{name:window.document.title,website:window.location.protocol+"//"+window.location.host+"/"},setupClient:function(_1){
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
Playdar.DefaultListeners={onStat:function(_3){
if(_3){
}else{
}
},onStartManualAuth:function(){
},onAuth:function(){
},onAuthClear:function(){
},onResults:function(_4,_5){
if(_5){
if(_4.results.length){
}else{
}
}else{
}
},onTagCloud:function(_6){
},onRQL:function(_7){
},onResolveIdle:function(){
}};
Playdar.Client=function(_8){
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
this.register_listeners(_8);
this.uuid=Playdar.Util.generate_uuid();
};
Playdar.Client.prototype={register_listener:function(_9,_a){
_a=_a||Playdar.Util.null_callback;
this.listeners[_9]=function(){
return _a.apply(Playdar.client,arguments);
};
},register_listeners:function(_b){
if(!_b){
return;
}
for(var _c in _b){
this.register_listener(_c,_b[_c]);
}
return true;
},register_results_handler:function(_d,_e){
if(_e){
this.results_handlers[_e]=_d;
}else{
this.register_listener("onResults",_d);
}
},go:function(){
if(!this.is_authed()){
this.auth_token=Playdar.Util.getcookie(Playdar.AUTH_COOKIE_NAME);
}
this.stat();
},stat:function(){
setTimeout(function(){
Playdar.client.check_stat_timeout();
},Playdar.STAT_TIMEOUT);
Playdar.Util.loadjs(this.get_url("stat","handle_stat"));
},check_stat_timeout:function(){
if(!this.stat_response||this.stat_response.name!="playdar"){
this.listeners.onStat(false);
}
},handle_stat:function(_f){
this.stat_response=_f;
if(Playdar.USE_STATUS_BAR){
new Playdar.StatusBar();
Playdar.status_bar.handle_stat(_f);
}
this.listeners.onStat(_f);
if(_f.authenticated){
if(!Playdar.scrobbler&&Playdar.USE_SCROBBLER&&_f.capabilities.audioscrobbler){
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
return this.get_base_url("/authcodes",{revoke:this.auth_token,jsonp:"Playdar.Util.null_callback"});
},get_auth_url:function(){
return this.get_base_url("/auth_1/",Playdar.auth_details);
},get_auth_link_html:function(_10){
_10=_10||"Connect";
var _11="<a href=\""+this.get_auth_url()+"\" target=\""+Playdar.AUTH_POPUP_NAME+"\" onclick=\"Playdar.client.start_auth(); return false;"+"\">"+_10+"</a>";
return _11;
},get_disconnect_link_html:function(_12){
_12=_12||"Disconnect";
var _13="<a href=\""+this.get_revoke_url()+"\" onclick=\"Playdar.client.clear_auth(); return false;"+"\">"+_12+"</a>";
return _13;
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
},auth_callback:function(_14){
Playdar.Util.setcookie(Playdar.AUTH_COOKIE_NAME,_14,365);
if(this.auth_popup&&!this.auth_popup.closed){
this.auth_popup.close();
this.auth_popup=null;
}
this.auth_token=_14;
this.stat();
},manual_auth_callback:function(_15){
var _16=document.getElementById(_15);
if(_16&&_16.value){
this.auth_callback(_16.value);
}
},autodetect:function(_17,_18){
if(!this.is_authed()){
return false;
}
var qid,i,j,_19,_1a;
try{
var mf=Playdar.Parse.microformats(_18);
var _1b=Playdar.Parse.rdfa(_18);
var _1c=mf.concat(_1b);
for(i=0;i<_1c.length;i++){
_19=_1c[i];
for(j=0;j<_19.tracks.length;j++){
_1a=_19.tracks[j];
if(_17){
qid=_17(_1a);
}
this.resolve(_1a.artist,_1a.title,_1a.album,qid);
}
}
return _1c;
}
catch(error){
console.warn(error);
}
},resolve:function(_1d,_1e,_1f,qid,url){
if(!this.is_authed()){
return false;
}
var _20={artist:_1d||"",album:_1f||"",track:_1e||"",url:url||"",qid:qid||Playdar.Util.generate_uuid()};
if(Playdar.player){
_20.mimetypes=Playdar.player.get_mime_types().join(",");
}
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.resolution_queue.push(_20);
this.process_resolution_queue();
},process_resolution_queue:function(){
if(this.resolutions_in_progress.count>=Playdar.MAX_CONCURRENT_RESOLUTIONS){
return false;
}
var _21=this.resolution_queue.length+this.resolutions_in_progress.count;
if(_21){
var _22=Playdar.MAX_CONCURRENT_RESOLUTIONS-this.resolutions_in_progress.count;
for(var i=1;i<=_22;i++){
var _23=this.resolution_queue.shift();
if(!_23){
break;
}
this.resolutions_in_progress.queries[_23.qid]=_23;
this.resolutions_in_progress.count++;
Playdar.Util.loadjs(this.get_url("resolve","handle_resolution",_23));
}
}else{
this.listeners.onResolveIdle();
}
},cancel_resolve:function(){
this.initialise_resolve();
if(Playdar.status_bar){
Playdar.status_bar.cancel_resolve();
}
},initialise_resolve:function(){
this.resolution_queue=[];
this.resolutions_in_progress={count:0,queries:{}};
},recheck_results:function(qid){
var _24={qid:qid};
this.resolutions_in_progress.queries[qid]=_24;
this.resolutions_in_progress.count++;
this.handle_resolution(_24);
},handle_resolution:function(_25){
if(this.resolutions_in_progress.queries[_25.qid]){
this.last_qid=_25.qid;
this.resolve_qids.push(this.last_qid);
this.get_results(_25.qid);
}
},get_results:function(qid){
if(this.resolutions_in_progress.queries[qid]){
if(!this.poll_counts[qid]){
this.poll_counts[qid]=0;
}
this.poll_counts[qid]++;
Playdar.Util.loadjs(this.get_url("get_results","handle_results",{qid:qid,poll:this.poll_counts[qid]}));
}
},poll_results:function(_26,_27,_28){
var _29=this.should_stop_polling(_26);
_28=_28||this;
if(!_29){
setTimeout(function(){
_27.call(_28,_26.qid);
},_26.poll_interval||_26.refresh_interval);
}
return _29;
},should_stop_polling:function(_2a){
if(_2a.poll_interval<=0||_2a.refresh_interval<=0){
return true;
}
if(_2a.solved===true){
return true;
}
if(this.poll_counts[_2a.qid]>=(_2a.poll_limit||Playdar.MAX_POLLS)){
return true;
}
return false;
},handle_results:function(_2b){
if(this.resolutions_in_progress.queries[_2b.qid]){
var _2c=this.poll_results(_2b,this.get_results);
if(Playdar.status_bar){
Playdar.status_bar.handle_results(_2b,_2c);
}
if(this.results_handlers[_2b.qid]){
this.results_handlers[_2b.qid](_2b,_2c);
}else{
this.listeners.onResults(_2b,_2c);
}
if(_2c){
delete this.resolutions_in_progress.queries[_2b.qid];
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
},get_base_url:function(_2d,_2e){
var url="http://"+Playdar.SERVER_ROOT+":"+Playdar.SERVER_PORT;
if(_2d){
url+=_2d;
}
if(_2e){
url+="?"+Playdar.Util.toQueryString(_2e);
}
return url;
},get_url:function(_2f,_30,_31){
_31=_31||{};
_31.call_id=new Date().getTime();
_31.method=_2f;
if(!_31.jsonp){
if(_30.join){
_31.jsonp=_30.join(".");
}else{
_31.jsonp=this.jsonp_callback(_30);
}
}
this.add_auth_token(_31);
return this.get_base_url("/api/",_31);
},add_auth_token:function(_32){
if(this.is_authed()){
_32.auth=this.auth_token;
}
return _32;
},get_stream_url:function(sid){
return this.get_base_url("/sid/"+sid);
},jsonp_callback:function(_33){
return "Playdar.client."+_33;
},list_results:function(_34){
for(var i=0;i<_34.results.length;i++){
console.log(_34.results[i].name);
}
}};
Playdar.Scrobbler=function(){
Playdar.scrobbler=this;
};
Playdar.Scrobbler.prototype={get_url:function(_35,_36){
_36=_36||{};
_36.call_id=new Date().getTime();
_36.jsonp=_36.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_36);
return Playdar.client.get_base_url("/audioscrobbler/"+_35,_36);
},start:function(_37,_38,_39,_3a,_3b,_3c){
var _3d={a:_37,t:_38,o:"P"};
if(_39){
_3d["b"]=_39;
}
if(_3a){
_3d["l"]=_3a;
}
if(_3b){
_3d["n"]=_3b;
}
if(_3c){
_3d["m"]=_3c;
}
Playdar.Util.loadjs(this.get_url("start",_3d));
},stop:function(){
Playdar.Util.loadjs(this.get_url("stop"));
},pause:function(){
Playdar.Util.loadjs(this.get_url("pause"));
},resume:function(){
Playdar.Util.loadjs(this.get_url("resume"));
},get_sound_callbacks:function(_3e){
var _3f=this;
return {onload:function(){
if(this.readyState==2){
_3f.stop();
this.unload();
}
},onplay:function(){
this.scrobbleStart=true;
},onpause:function(){
_3f.pause();
},onresume:function(){
_3f.resume();
},onfinish:function(){
if(!this.chained){
_3f.stop();
}
},whileplaying:function(){
if(this.scrobbleStart){
this.scrobbleStart=false;
_3f.start(_3e.artist,_3e.track,_3e.album,_3e.duration);
}
}};
}};
Playdar.Player=function(_40){
Playdar.player=this;
this.streams={};
this.nowplayingid=null;
this.soundmanager=_40;
};
Playdar.Player.MIMETYPES={"audio/mpeg":false,"audio/aac":true,"audio/x-aac":true,"audio/flv":true,"audio/mov":true,"audio/mp4":true,"audio/m4v":true,"audio/f4v":true,"audio/m4a":true,"audio/x-m4a":true,"audio/x-m4b":true,"audio/mp4v":true,"audio/3gp":true,"audio/3g2":true};
Playdar.Player.prototype={get_mime_types:function(){
var _41=[];
for(var _42 in Playdar.Player.MIMETYPES){
_41.push(_42);
}
return _41;
},register_stream:function(_43,_44){
if(this.streams[_43.sid]){
return false;
}
this.streams[_43.sid]=_43;
var _45=Playdar.Util.extend_object({id:"s_"+_43.sid,url:Playdar.client.get_stream_url(_43.sid),isMovieStar:Playdar.Player.MIMETYPES[_43.mimetype]===true,bufferTime:2},_44);
var _46=[_44];
if(Playdar.status_bar){
_46.push(Playdar.status_bar.get_sound_callbacks(_43));
}
if(Playdar.scrobbler){
_46.push(Playdar.scrobbler.get_sound_callbacks(_43));
}
Playdar.Util.extend_object(_45,Playdar.Util.merge_callback_options(_46));
try{
var _47=this.soundmanager.createSound(_45);
}
catch(e){
return false;
}
return _47;
},play_stream:function(sid){
var _48=this.soundmanager.getSoundById("s_"+sid);
if(this.nowplayingid!=sid){
this.stop_current();
if(_48.playState===0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_48.togglePause();
return _48;
},stop_current:function(_49){
if(_49){
if(Playdar.scrobbler){
Playdar.scrobbler.stop();
}
}
if(this.nowplayingid){
var _4a=this.soundmanager.getSoundById("s_"+this.nowplayingid);
if(_4a.playState==1){
_4a.setPosition(1);
_4a.stop();
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
var _4b=document.createElement("div");
_4b.style.position="fixed";
_4b.style.bottom=0;
_4b.style.left=0;
_4b.style.zIndex=100;
_4b.style.width="100%";
_4b.style.height="36px";
_4b.style.padding="7px 0";
_4b.style.borderTop="2px solid #4c7a0f";
_4b.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_4b.style.color="#335507";
_4b.style.background="#e8f9bb";
var _4c=document.createElement("div");
_4c.style.padding="0 7px";
var _4d="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_4c.innerHTML=_4d;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_4c.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _4e=document.createElement("p");
_4e.style.margin="0";
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
_4e.appendChild(this.track_link);
this.playback.appendChild(_4e);
var _4f=document.createElement("table");
_4f.setAttribute("cellpadding",0);
_4f.setAttribute("cellspacing",0);
_4f.setAttribute("border",0);
_4f.style.color="#4c7a0f";
_4f.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _50=document.createElement("tbody");
var _51=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_51.appendChild(this.track_elapsed);
var _52=document.createElement("td");
_52.style.padding="0 5px";
_52.style.verticalAlign="middle";
var _53=document.createElement("div");
_53.style.width=this.progress_bar_width+"px";
_53.style.height="9px";
_53.style.border="1px solid #4c7a0f";
_53.style.background="#fff";
_53.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_53.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_53.appendChild(this.playhead);
_53.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_52.appendChild(_53);
_51.appendChild(_52);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_51.appendChild(this.track_duration);
_50.appendChild(_51);
_4f.appendChild(_50);
this.playback.appendChild(_4f);
_4c.appendChild(this.playback);
var _54=document.createElement("div");
_54.style.cssFloat="right";
_54.style.padding="0 8px";
_54.style.textAlign="right";
var _55=document.createElement("p");
_55.style.margin=0;
_55.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_54.appendChild(_55);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML=Playdar.client.get_disconnect_link_html();
_54.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_4b.appendChild(_54);
_4b.appendChild(_4c);
document.body.appendChild(_4b);
var _56=document.body.style.marginBottom;
if(!_56){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_56=css.marginBottom;
}
}
document.body.style.marginBottom=(_56.replace("px","")-0)+36+(7*2)+2+"px";
return _4b;
},ready:function(){
this.playdar_links.style.display="";
var _57="Ready";
this.status.innerHTML=_57;
},offline:function(){
this.playdar_links.style.display="none";
var _58=Playdar.client.get_auth_link_html();
this.status.innerHTML=_58;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _59="manualAuth_"+Playdar.client.uuid;
var _5a="<form>"+"<input type=\"text\" id=\""+_59+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_59+"'); return false;"+"\" />"+"</form>";
this.status.innerHTML=_5a;
Playdar.Util.select("#"+_59)[0].focus();
},handle_stat:function(_5b){
if(_5b.authenticated){
this.ready();
}else{
this.offline();
}
},show_resolution_status:function(){
if(this.query_count){
var _5c=" ";
if(this.pending_count){
_5c+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_5c+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_5c;
}
},handle_results:function(_5d,_5e){
if(_5e){
this.pending_count--;
if(_5d.results.length){
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
},get_sound_callbacks:function(_5f){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
}};
},play_handler:function(_60){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_60.sid);
this.track_link.title=_60.source;
this.track_name.innerHTML=_60.track;
this.artist_name.innerHTML=_60.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_60.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_61){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_61.position/1000));
var _62;
if(_61.readyState==3){
_62=_61.duration;
}else{
_62=_61.durationEstimate;
}
var _63=_61.position/_62;
this.playhead.style.width=Math.round(_63*this.progress_bar_width)+"px";
this.loading_handler(_61);
},loading_handler:function(_64){
var _65=_64.bytesLoaded/_64.bytesTotal;
this.bufferhead.style.width=Math.round(_65*this.progress_bar_width)+"px";
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
var _66="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _67=[];
var rnd=Math.random;
var r;
_67[8]=_67[13]=_67[18]=_67[23]="-";
_67[14]="4";
for(var i=0;i<36;i++){
if(!_67[i]){
r=0|rnd()*16;
_67[i]=_66[(i==19)?(r&3)|8:r&15];
}
}
return _67.join("");
},toQueryPair:function(key,_68){
if(_68===null){
return key;
}
return key+"="+encodeURIComponent(_68);
},toQueryString:function(_69){
var _6a=[];
for(var key in _69){
var _6b=_69[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_6b)=="[object Array]"){
for(var i=0;i<_6b.length;i++){
_6a.push(Playdar.Util.toQueryPair(key,_6b[i]));
}
}else{
_6a.push(Playdar.Util.toQueryPair(key,_6b));
}
}
return _6a.join("&");
},mmss:function(_6c){
var s=_6c%60;
if(s<10){
s="0"+s;
}
return Math.floor(_6c/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_6d,_6e,_6f){
var _70;
if(_6f){
var _71=new Date();
_71.setTime(_71.getTime()+(_6f*24*60*60*1000));
_70="; expires="+_71.toGMTString();
}else{
_70="";
}
document.cookie=_6d+"="+_6e+_70+"; path=/";
},getcookie:function(_72){
var _73=_72+"=";
var _74=document.cookie.split(";");
for(var i=0;i<_74.length;i++){
var c=_74[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_73)===0){
return c.substring(_73.length,c.length);
}
}
return null;
},deletecookie:function(_75){
Playdar.Util.setcookie(_75,"",-1);
},get_window_position:function(){
var _76={};
if(window.screenLeft){
_76.x=window.screenLeft||0;
_76.y=window.screenTop||0;
}else{
_76.x=window.screenX||0;
_76.y=window.screenY||0;
}
return _76;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_77){
var _78=Playdar.Util.get_popup_location(_77);
return ["left="+_78.x,"top="+_78.y,"width="+_77.w,"height="+_77.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_79){
var _7a=Playdar.Util.get_window_position();
var _7b=Playdar.Util.get_window_size();
return {"x":Math.max(0,_7a.x+(_7b.w-_79.w)/2),"y":Math.max(0,_7a.y+(_7b.h-_79.h)/2)};
},addEvent:function(obj,_7c,fn){
if(obj.attachEvent){
obj["e"+_7c+fn]=fn;
obj[_7c+fn]=function(){
obj["e"+_7c+fn](window.event);
};
obj.attachEvent("on"+_7c,obj[_7c+fn]);
}else{
obj.addEventListener(_7c,fn,false);
}
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_7d,_7e){
_7e=_7e||{};
for(var _7f in _7e){
_7d[_7f]=_7e[_7f];
}
return _7d;
},merge_callback_options:function(_80){
var _81={};
var _82=[];
var i,_83,_84;
for(i=0;i<_80.length;i++){
_83=_80[i];
for(_84 in _83){
if(typeof (_83[_84])=="function"){
if(!_81[_84]){
_82.push(_84);
_81[_84]=[];
}
_81[_84].push(_83);
}
}
}
var _85={};
for(i=0;i<_82.length;i++){
var key=_82[i];
_85[key]=(function(key,_86){
return function(){
for(var j=0;j<_86.length;j++){
_86[j][key].apply(this,arguments);
}
};
})(key,_81[key]);
}
return _85;
},location_from_url:function(url){
var _87=document.createElement("a");
_87.href=url;
var _88={};
for(k in window.location){
if((typeof (window.location[k])==="string")){
_88[k]=_87[k];
}
}
return _88;
},log:function(_89){
if(typeof console!="undefined"){
console.dir(_89);
}
},null_callback:function(){
}};
Playdar.Parse={getProperty:function(_8a,_8b){
var _8b=_8b||"innerHTML";
var i,_8c,_8d;
for(i=0;i<_8a.length;i++){
_8c=_8a[i];
_8d=_8c[_8b]||_8c.getAttribute(_8b);
if(_8d){
return _8d;
}
}
return;
},getValue:function(_8e){
var i,_8f,_90;
for(i=0;i<_8e.length;i++){
_8f=_8e[i];
_90=Playdar.Util.select(".value",_8f);
if(_90.length){
return Playdar.Parse.getContentWithoutValue(_90);
}
}
return;
},getContentWithoutValue:function(_91){
return Playdar.Parse.getProperty(_91,"content")||Playdar.Parse.getProperty(_91,"title")||Playdar.Parse.getProperty(_91);
},getContent:function(_92){
var _93=Playdar.Parse.getValue(_92)||Playdar.Parse.getContentWithoutValue(_92);
if(_93){
return _93.replace(/(^\s*)|(\s*$)/g,"");
}
return;
},getPosition:function(_94){
var _95=_94;
var _96=0;
if(_94.nodeName=="LI"&&_94.parentNode.nodeName=="OL"){
while(_95.previousSibling){
_95=_95.previousSibling;
if(_95.nodeName=="LI"){
_96++;
}
}
return _96+1;
}
return;
},getNS:function(_97,url){
for(var i=0;i<_97.attributes.length;i++){
var _98=_97.attributes[i];
if(_98.nodeValue==url){
return _98.nodeName.replace("xmlns:","");
}
}
},getExc:function(_99,_9a){
return ":not("+_99+" "+_9a+")";
},microformats:function(_9b){
var sel=Playdar.Util.select;
function _9c(_9d,_9e){
return sel(_9d+Playdar.Parse.getExc(".item",_9d),_9e);
};
function _9f(_a0,rec){
var _a1=rec?sel:_9c;
var _a2=Playdar.Parse.getProperty(_a1(".payment",_a0),"href")||Playdar.Parse.getProperty(_a1("[rel~=payment]",_a0),"href");
if(!_a2){
return;
}
return {url:_a2,currency:Playdar.Parse.getContent(_a1(".price .currency",_a0)),amount:Playdar.Parse.getContent(_a1(".price .amount",_a0))};
};
function _a3(_a4,_a5,_a6){
var _a7=[];
var i,_a8;
for(i=0;i<_a4.length;i++){
if(!_a4[i].playdarParsed){
_a8={title:Playdar.Parse.getContent(sel(".fn",_a4[i]))||Playdar.Parse.getContent(sel(".title",_a4[i])),artist:Playdar.Parse.getContent(sel(".contributor",_a4[i]))||_a5,album:_a6,position:Playdar.Parse.getContent(sel(".position",_a4[i]))||Playdar.Parse.getPosition(_a4[i]),duration:Playdar.Parse.getContent(sel(".duration",_a4[i])),buy:_9f(_a4[i],true),element:_a4[i]};
_a7.push(_a8);
_a4[i].playdarParsed=true;
}
}
return _a7;
};
function _a9(_aa){
var _ab=_9c(".contributor",_aa);
var _ac=Playdar.Parse.getContent(sel(".fn",_ab[0]));
if(!_ac){
_ac=Playdar.Parse.getContent(_ab);
}
return _ac;
};
function _ad(_ae){
var _af=[];
var _b0=sel(".haudio",_ae);
var i,_b1,_b2,_b3,_b4,_b5,_b6,_b7;
for(i=0;i<_b0.length;i++){
if(!_b0[i].playdarParsed){
_b1=Playdar.Parse.getContent(_9c(".album",_b0[i]));
if(!_b1){
continue;
}
_b2=_a9(_b0[i]);
if(!_b2){
continue;
}
_b3=_a3(sel(".item",_b0[i]),_b2,_b1);
if(!_b3.length){
continue;
}
_af.push({type:"album",title:_b1,artist:_b2,tracks:_b3,image:Playdar.Parse.getProperty(_9c(".photo",_b0[i]),"src")||Playdar.Parse.getProperty(_9c(".photo",_b0[i]),"href"),download:Playdar.Parse.getProperty(_9c("[rel~=enclosure]",_b0[i]),"href"),released:Playdar.Parse.getContent(_9c(".published",_b0[i])),duration:Playdar.Parse.getContent(_9c(".duration",_b0[i])),buy:_9f(_b0[i])});
_b0[i].playdarParsed=true;
}
}
return _af;
};
function _b8(_b9){
var _ba=_ad(_b9);
var _bb=_a3(sel(".haudio"));
if(_bb.length){
_ba.push({type:"page",title:window.document.title||window.location.href,tracks:_bb});
}
return _ba;
};
var _bc=_b8(_9b);
return _bc;
},rdfa:function(_bd){
var sel=Playdar.Util.select;
var _be=sel("html")[0];
var _bf=Playdar.Parse.getNS(_be,"http://purl.org/commerce#");
var _c0=Playdar.Parse.getNS(_be,"http://purl.org/media/audio#");
var _c1=Playdar.Parse.getNS(_be,"http://purl.org/media#");
var _c2=Playdar.Parse.getNS(_be,"http://purl.org/dc/terms/")||Playdar.Parse.getNS(_be,"http://purl.org/dc/elements/1.1/");
var _c3=Playdar.Parse.getNS(_be,"http://xmlns.com/foaf/0.1/");
var _c4=Playdar.Parse.getNS(_be,"http://purl.org/ontology/mo/");
function _c5(_c6,_c7){
var _c8=_c6;
if(_c0){
_c8+=Playdar.Parse.getExc("[typeof="+_c0+":Recording]",_c6);
}
if(_c4){
_c8+=Playdar.Parse.getExc("[typeof="+_c4+":Track]",_c6);
}
return sel(_c8,_c7);
};
if(!_c0&&!_c4){
return [];
}
function _c9(_ca,rec){
var _cb=rec?sel:_c5;
var _cc=Playdar.Parse.getProperty(_cb("[rel~="+_bf+":payment]",_ca),"href");
if(!_cc){
return;
}
return {url:_cc,currency:Playdar.Parse.getContent(_cb("[rel~="+_bf+":costs] [property="+_bf+":currency]",_ca)),amount:Playdar.Parse.getContent(_cb("[rel~="+_bf+":costs] [property="+_bf+":amount]",_ca))};
};
function _cd(_ce,_cf,_d0){
var _d1=[];
var _d2=[];
if(_c0){
_d2.push("[typeof="+_c0+":Recording]");
}
if(_c4){
_d2.push("[typeof="+_c4+":Track]");
}
var _d3=_c5(_d2.join(","),_ce);
var i,_d4;
for(i=0;i<_d3.length;i++){
if(!_d3[i].playdarParsed){
_d4={title:Playdar.Parse.getContent(sel("[property="+_c2+":title]",_d3[i])),artist:Playdar.Parse.getContent(sel("[property="+_c2+":creator], [rel~="+_c3+":maker] [property="+_c3+":name]",_d3[i]))||_cf,album:Playdar.Parse.getContent(sel("[typeof="+_c4+":Record] [property="+_c2+":title]"))||_d0,position:Playdar.Parse.getContent(sel("[property="+_c1+":position]",_d3[i]))||Playdar.Parse.getPosition(_d3[i]),duration:Playdar.Parse.getContent(sel("[property="+_c1+":duration]",_d3[i]))||Playdar.Parse.getContent(sel("[property="+_c2+":duration]",_d3[i])),buy:_c9(_d3[i],true),element:_d3[i]};
_d1.push(_d4);
_d3[i].playdarParsed=true;
}
}
return _d1;
};
function _d5(_d6){
var _d7=_c5("[property="+_c2+":creator]",_d6);
if(!_d7.length){
_d7=_c5("[rel~="+_c3+":maker]",_d6);
}
var _d8;
if(_d7.length){
_d8=Playdar.Parse.getContent(sel("[property="+_c3+":name]",_d7[0]));
}
if(!_d8){
var _d9=sel("[rel~="+_c2+":creator]",_d6);
var _da=Playdar.Parse.getProperty(_d9,"resource");
if(_da){
var _db=sel("[about="+_da+"]");
_d8=Playdar.Parse.getContent(sel("[property="+_c3+":name]",_db[0]))||Playdar.Parse.getContent(_db);
}
}
if(!_d8){
_d8=Playdar.Parse.getContent(_d7);
}
return _d8;
};
function _dc(_dd){
var _de=[];
var _df=sel("[typeof="+_c0+":Album], [typeof="+_c4+":Record]",_dd);
var i,_e0,_e1,_e2,_e3;
for(i=0;i<_df.length;i++){
if(!_df[i].playdarParsed){
_e1=Playdar.Parse.getContent(_c5("[property="+_c2+":title]",_df[i]));
if(!_e1){
continue;
}
_e2=_d5(_df[i]);
if(!_e2){
continue;
}
_e3=_cd(_df[i],_e2,_e1);
if(!_e3.length){
continue;
}
_de.push({type:"album",title:_e1,artist:_e2,tracks:_e3,image:Playdar.Parse.getProperty(_c5("[rel~="+_c1+":depiction]",_df[i]),"src")||Playdar.Parse.getProperty(_c5("[rev~="+_c1+":depiction]",_df[i]),"src"),download:Playdar.Parse.getProperty(_c5("[rel~="+_c1+":download]",_df[i]),"href"),released:Playdar.Parse.getContent(_c5("[property="+_c2+":issued]",_df[i]))||Playdar.Parse.getContent(_c5("[property="+_c2+":published]",_df[i]))||Playdar.Parse.getContent(_c5("[property="+_c2+":date]",_df[i])),duration:Playdar.Parse.getContent(_c5("[property="+_c1+":duration]",_df[i]))||Playdar.Parse.getContent(_c5("[property="+_c2+":duration]",_df[i])),buy:_c9(_df[i])});
_df[i].playdarParsed=true;
}
}
return _de;
};
function _e4(_e5){
var _e6=_dc(_e5);
var _e7=_cd(_e5);
if(_e7.length){
_e6.push({type:"page",title:window.document.title||window.location.href,tracks:_e7});
}
return _e6;
};
var _e8=_e4(_bd);
return _e8;
}};
Playdar.Util.addEvent(window,"beforeunload",Playdar.unload);
(function(){
var _e9=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_ea=0,_eb=Object.prototype.toString,_ec=false;
var _ed=function(_ee,_ef,_f0,_f1){
_f0=_f0||[];
var _f2=_ef=_ef||document;
if(_ef.nodeType!==1&&_ef.nodeType!==9){
return [];
}
if(!_ee||typeof _ee!=="string"){
return _f0;
}
var _f3=[],m,set,_f4,_f5,_f6,_f7,_f8=true,_f9=_fa(_ef);
_e9.lastIndex=0;
while((m=_e9.exec(_ee))!==null){
_f3.push(m[1]);
if(m[2]){
_f7=RegExp.rightContext;
break;
}
}
if(_f3.length>1&&_fb.exec(_ee)){
if(_f3.length===2&&_fc.relative[_f3[0]]){
set=_fd(_f3[0]+_f3[1],_ef);
}else{
set=_fc.relative[_f3[0]]?[_ef]:_ed(_f3.shift(),_ef);
while(_f3.length){
_ee=_f3.shift();
if(_fc.relative[_ee]){
_ee+=_f3.shift();
}
set=_fd(_ee,set);
}
}
}else{
if(!_f1&&_f3.length>1&&_ef.nodeType===9&&!_f9&&_fc.match.ID.test(_f3[0])&&!_fc.match.ID.test(_f3[_f3.length-1])){
var ret=_ed.find(_f3.shift(),_ef,_f9);
_ef=ret.expr?_ed.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_ef){
var ret=_f1?{expr:_f3.pop(),set:_fe(_f1)}:_ed.find(_f3.pop(),_f3.length===1&&(_f3[0]==="~"||_f3[0]==="+")&&_ef.parentNode?_ef.parentNode:_ef,_f9);
set=ret.expr?_ed.filter(ret.expr,ret.set):ret.set;
if(_f3.length>0){
_f4=_fe(set);
}else{
_f8=false;
}
while(_f3.length){
var cur=_f3.pop(),pop=cur;
if(!_fc.relative[cur]){
cur="";
}else{
pop=_f3.pop();
}
if(pop==null){
pop=_ef;
}
_fc.relative[cur](_f4,pop,_f9);
}
}else{
_f4=_f3=[];
}
}
if(!_f4){
_f4=set;
}
if(!_f4){
throw "Syntax error, unrecognized expression: "+(cur||_ee);
}
if(_eb.call(_f4)==="[object Array]"){
if(!_f8){
_f0.push.apply(_f0,_f4);
}else{
if(_ef&&_ef.nodeType===1){
for(var i=0;_f4[i]!=null;i++){
if(_f4[i]&&(_f4[i]===true||_f4[i].nodeType===1&&_ff(_ef,_f4[i]))){
_f0.push(set[i]);
}
}
}else{
for(var i=0;_f4[i]!=null;i++){
if(_f4[i]&&_f4[i].nodeType===1){
_f0.push(set[i]);
}
}
}
}
}else{
_fe(_f4,_f0);
}
if(_f7){
_ed(_f7,_f2,_f0,_f1);
_ed.uniqueSort(_f0);
}
return _f0;
};
_ed.uniqueSort=function(_100){
if(_101){
_ec=false;
_100.sort(_101);
if(_ec){
for(var i=1;i<_100.length;i++){
if(_100[i]===_100[i-1]){
_100.splice(i--,1);
}
}
}
}
};
_ed.matches=function(expr,set){
return _ed(expr,null,null,set);
};
_ed.find=function(expr,_102,_103){
var set,_104;
if(!expr){
return [];
}
for(var i=0,l=_fc.order.length;i<l;i++){
var type=_fc.order[i],_104;
if((_104=_fc.match[type].exec(expr))){
var left=RegExp.leftContext;
if(left.substr(left.length-1)!=="\\"){
_104[1]=(_104[1]||"").replace(/\\/g,"");
set=_fc.find[type](_104,_102,_103);
if(set!=null){
expr=expr.replace(_fc.match[type],"");
break;
}
}
}
}
if(!set){
set=_102.getElementsByTagName("*");
}
return {set:set,expr:expr};
};
_ed.filter=function(expr,set,_105,not){
var old=expr,_106=[],_107=set,_108,_109,_10a=set&&set[0]&&_fa(set[0]);
while(expr&&set.length){
for(var type in _fc.filter){
if((_108=_fc.match[type].exec(expr))!=null){
var _10b=_fc.filter[type],_10c,item;
_109=false;
if(_107==_106){
_106=[];
}
if(_fc.preFilter[type]){
_108=_fc.preFilter[type](_108,_107,_105,_106,not,_10a);
if(!_108){
_109=_10c=true;
}else{
if(_108===true){
continue;
}
}
}
if(_108){
for(var i=0;(item=_107[i])!=null;i++){
if(item){
_10c=_10b(item,_108,i,_107);
var pass=not^!!_10c;
if(_105&&_10c!=null){
if(pass){
_109=true;
}else{
_107[i]=false;
}
}else{
if(pass){
_106.push(item);
_109=true;
}
}
}
}
}
if(_10c!==undefined){
if(!_105){
_107=_106;
}
expr=expr.replace(_fc.match[type],"");
if(!_109){
return [];
}
break;
}
}
}
if(expr==old){
if(_109==null){
throw "Syntax error, unrecognized expression: "+expr;
}else{
break;
}
}
old=expr;
}
return _107;
};
var _fc=_ed.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(elem){
return elem.getAttribute("href");
}},relative:{"+":function(_10d,part,_10e){
var _10f=typeof part==="string",_110=_10f&&!(/\W/).test(part),_111=_10f&&!_110;
if(_110&&!_10e){
part=part.toUpperCase();
}
for(var i=0,l=_10d.length,elem;i<l;i++){
if((elem=_10d[i])){
while((elem=elem.previousSibling)&&elem.nodeType!==1){
}
_10d[i]=_111||elem&&elem.nodeName===part?elem||false:elem===part;
}
}
if(_111){
_ed.filter(part,_10d,true);
}
},">":function(_112,part,_113){
var _114=typeof part==="string";
if(_114&&!(/\W/).test(part)){
part=_113?part:part.toUpperCase();
for(var i=0,l=_112.length;i<l;i++){
var elem=_112[i];
if(elem){
var _115=elem.parentNode;
_112[i]=_115.nodeName===part?_115:false;
}
}
}else{
for(var i=0,l=_112.length;i<l;i++){
var elem=_112[i];
if(elem){
_112[i]=_114?elem.parentNode:elem.parentNode===part;
}
}
if(_114){
_ed.filter(part,_112,true);
}
}
},"":function(_116,part,_117){
var _118=_ea++,_119=_11a;
if(!part.match(/\W/)){
var _11b=part=_117?part:part.toUpperCase();
_119=_11c;
}
_119("parentNode",part,_118,_116,_11b,_117);
},"~":function(_11d,part,_11e){
var _11f=_ea++,_120=_11a;
if(typeof part==="string"&&!part.match(/\W/)){
var _121=part=_11e?part:part.toUpperCase();
_120=_11c;
}
_120("previousSibling",part,_11f,_11d,_121,_11e);
}},find:{ID:function(_122,_123,_124){
if(typeof _123.getElementById!=="undefined"&&!_124){
var m=_123.getElementById(_122[1]);
return m?[m]:[];
}
},NAME:function(_125,_126,_127){
if(typeof _126.getElementsByName!=="undefined"){
var ret=[],_128=_126.getElementsByName(_125[1]);
for(var i=0,l=_128.length;i<l;i++){
if(_128[i].getAttribute("name")===_125[1]){
ret.push(_128[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_129,_12a){
return _12a.getElementsByTagName(_129[1]);
}},preFilter:{CLASS:function(_12b,_12c,_12d,_12e,not,_12f){
_12b=" "+_12b[1].replace(/\\/g,"")+" ";
if(_12f){
return _12b;
}
for(var i=0,elem;(elem=_12c[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_12b)>=0)){
if(!_12d){
_12e.push(elem);
}
}else{
if(_12d){
_12c[i]=false;
}
}
}
}
return false;
},ID:function(_130){
return _130[1].replace(/\\/g,"");
},TAG:function(_131,_132){
for(var i=0;_132[i]===false;i++){
}
return _132[i]&&_fa(_132[i])?_131[1]:_131[1].toUpperCase();
},CHILD:function(_133){
if(_133[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_133[2]=="even"&&"2n"||_133[2]=="odd"&&"2n+1"||!(/\D/).test(_133[2])&&"0n+"+_133[2]||_133[2]);
_133[2]=(test[1]+(test[2]||1))-0;
_133[3]=test[3]-0;
}
_133[0]=_ea++;
return _133;
},ATTR:function(_134,_135,_136,_137,not,_138){
var name=_134[1].replace(/\\/g,"");
if(!_138&&_fc.attrMap[name]){
_134[1]=_fc.attrMap[name];
}
if(_134[2]==="~="){
_134[4]=" "+_134[4]+" ";
}
return _134;
},PSEUDO:function(_139,_13a,_13b,_13c,not){
if(_139[1]==="not"){
if(_139[3].match(_e9).length>1||(/^\w/).test(_139[3])){
_139[3]=_ed(_139[3],null,null,_13a);
}else{
var ret=_ed.filter(_139[3],_13a,_13b,true^not);
if(!_13b){
_13c.push.apply(_13c,ret);
}
return false;
}
}else{
if(_fc.match.POS.test(_139[0])||_fc.match.CHILD.test(_139[0])){
return true;
}
}
return _139;
},POS:function(_13d){
_13d.unshift(true);
return _13d;
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
},has:function(elem,i,_13e){
return !!_ed(_13e[3],elem).length;
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
},last:function(elem,i,_13f,_140){
return i===_140.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_141){
return i<_141[3]-0;
},gt:function(elem,i,_142){
return i>_142[3]-0;
},nth:function(elem,i,_143){
return _143[3]-0==i;
},eq:function(elem,i,_144){
return _144[3]-0==i;
}},filter:{PSEUDO:function(elem,_145,i,_146){
var name=_145[1],_147=_fc.filters[name];
if(_147){
return _147(elem,i,_145,_146);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_145[3])>=0;
}else{
if(name==="not"){
var not=_145[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_148){
var type=_148[1],node=elem;
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
var _149=_148[2],last=_148[3];
if(_149==1&&last==0){
return true;
}
var _14a=_148[0],_14b=elem.parentNode;
if(_14b&&(_14b.sizcache!==_14a||!elem.nodeIndex)){
var _14c=0;
for(node=_14b.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_14c;
}
}
_14b.sizcache=_14a;
}
var diff=elem.nodeIndex-last;
if(_149==0){
return diff==0;
}else{
return (diff%_149==0&&diff/_149>=0);
}
}
},ID:function(elem,_14d){
return elem.nodeType===1&&elem.getAttribute("id")===_14d;
},TAG:function(elem,_14e){
return (_14e==="*"&&elem.nodeType===1)||elem.nodeName===_14e;
},CLASS:function(elem,_14f){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_14f)>-1;
},ATTR:function(elem,_150){
var name=_150[1],_151=_fc.attrHandle[name]?_fc.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_152=_151+"",type=_150[2],_153=_150[4];
return _151==null?type==="!=":type==="="?_152===_153:type==="*="?_152.indexOf(_153)>=0:type==="~="?(" "+_152+" ").indexOf(_153)>=0:!_153?_152&&_151!==false:type==="!="?_152!=_153:type==="^="?_152.indexOf(_153)===0:type==="$="?_152.substr(_152.length-_153.length)===_153:type==="|="?_152===_153||_152.substr(0,_153.length+1)===_153+"-":false;
},POS:function(elem,_154,i,_155){
var name=_154[2],_156=_fc.setFilters[name];
if(_156){
return _156(elem,i,_154,_155);
}
}}};
var _fb=_fc.match.POS;
for(var type in _fc.match){
_fc.match[type]=new RegExp(_fc.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _fe=function(_157,_158){
_157=Array.prototype.slice.call(_157);
if(_158){
_158.push.apply(_158,_157);
return _158;
}
return _157;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_fe=function(_159,_15a){
var ret=_15a||[];
if(_eb.call(_159)==="[object Array]"){
Array.prototype.push.apply(ret,_159);
}else{
if(typeof _159.length==="number"){
for(var i=0,l=_159.length;i<l;i++){
ret.push(_159[i]);
}
}else{
for(var i=0;_159[i];i++){
ret.push(_159[i]);
}
}
}
return ret;
};
}
var _101;
if(document.documentElement.compareDocumentPosition){
_101=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_ec=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_101=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_ec=true;
}
return ret;
};
}else{
if(document.createRange){
_101=function(a,b){
var _15b=a.ownerDocument.createRange(),_15c=b.ownerDocument.createRange();
_15b.selectNode(a);
_15b.collapse(true);
_15c.selectNode(b);
_15c.collapse(true);
var ret=_15b.compareBoundaryPoints(Range.START_TO_END,_15c);
if(ret===0){
_ec=true;
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
_fc.find.ID=function(_15d,_15e,_15f){
if(typeof _15e.getElementById!=="undefined"&&!_15f){
var m=_15e.getElementById(_15d[1]);
return m?m.id===_15d[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_15d[1]?[m]:undefined:[];
}
};
_fc.filter.ID=function(elem,_160){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_160;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_fc.find.TAG=function(_161,_162){
var _163=_162.getElementsByTagName(_161[1]);
if(_161[1]==="*"){
var tmp=[];
for(var i=0;_163[i];i++){
if(_163[i].nodeType===1){
tmp.push(_163[i]);
}
}
_163=tmp;
}
return _163;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_fc.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _164=_ed,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_ed=function(_165,_166,_167,seed){
_166=_166||document;
if(!seed&&_166.nodeType===9&&!_fa(_166)){
try{
return _fe(_166.querySelectorAll(_165),_167);
}
catch(e){
}
}
return _164(_165,_166,_167,seed);
};
for(var prop in _164){
_ed[prop]=_164[prop];
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
_fc.order.splice(1,0,"CLASS");
_fc.find.CLASS=function(_168,_169,_16a){
if(typeof _169.getElementsByClassName!=="undefined"&&!_16a){
return _169.getElementsByClassName(_168[1]);
}
};
})();
}
function _11c(dir,cur,_16b,_16c,_16d,_16e){
var _16f=dir=="previousSibling"&&!_16e;
for(var i=0,l=_16c.length;i<l;i++){
var elem=_16c[i];
if(elem){
if(_16f&&elem.nodeType===1){
elem.sizcache=_16b;
elem.sizset=i;
}
elem=elem[dir];
var _170=false;
while(elem){
if(elem.sizcache===_16b){
_170=_16c[elem.sizset];
break;
}
if(elem.nodeType===1&&!_16e){
elem.sizcache=_16b;
elem.sizset=i;
}
if(elem.nodeName===cur){
_170=elem;
break;
}
elem=elem[dir];
}
_16c[i]=_170;
}
}
};
function _11a(dir,cur,_171,_172,_173,_174){
var _175=dir=="previousSibling"&&!_174;
for(var i=0,l=_172.length;i<l;i++){
var elem=_172[i];
if(elem){
if(_175&&elem.nodeType===1){
elem.sizcache=_171;
elem.sizset=i;
}
elem=elem[dir];
var _176=false;
while(elem){
if(elem.sizcache===_171){
_176=_172[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_174){
elem.sizcache=_171;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_176=true;
break;
}
}else{
if(_ed.filter(cur,[elem]).length>0){
_176=elem;
break;
}
}
}
elem=elem[dir];
}
_172[i]=_176;
}
}
};
var _ff=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _fa=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _fd=function(_177,_178){
var _179=[],_17a="",_17b,root=_178.nodeType?[_178]:_178;
while((_17b=_fc.match.PSEUDO.exec(_177))){
_17a+=_17b[0];
_177=_177.replace(_fc.match.PSEUDO,"");
}
_177=_fc.relative[_177]?_177+"*":_177;
for(var i=0,l=root.length;i<l;i++){
_ed(_177,root[i],_179);
}
return _ed.filter(_17a,_179);
};
Playdar.Util.select=_ed;
})();

