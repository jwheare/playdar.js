Playdar={VERSION:"0.4.5",SERVER_ROOT:"localhost",SERVER_PORT:"60210",STATIC_HOST:"http://www.playdar.org",STAT_TIMEOUT:2000,AUTH_COOKIE_NAME:"Playdar.Auth",AUTH_POPUP_NAME:"Playdar.AuthPopup",AUTH_POPUP_SIZE:{"w":500,"h":260},QUERIES_POPUP_NAME:"Playdar.QueriesPopup",QUERIES_POPUP_SIZE:{"w":640,"h":700},MAX_POLLS:4,MAX_CONCURRENT_RESOLUTIONS:5,USE_STATUS_BAR:true,USE_SCROBBLER:true,client:null,status_bar:null,player:null,setup:function(_1){
new Playdar.Client(_1);
new Playdar.Boffin();
},setup_player:function(_2){
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
Playdar.Client=function(_8,_9){
Playdar.client=this;
this.auth_token=false;
this.auth_popup=null;
this.listeners={};
this.results_handlers={};
this.resolve_qids=[];
this.last_qid="";
this.poll_counts={};
this.initialise_resolve();
this.auth_details=_8;
this.register_listeners(Playdar.DefaultListeners);
this.register_listeners(_9);
this.uuid=Playdar.Util.generate_uuid();
};
Playdar.Client.prototype={register_listener:function(_a,_b){
_b=_b||Playdar.Util.null_callback;
this.listeners[_a]=function(){
return _b.apply(Playdar.client,arguments);
};
},register_listeners:function(_c){
if(!_c){
return;
}
for(var _d in _c){
this.register_listener(_d,_c[_d]);
}
return true;
},register_results_handler:function(_e,_f){
if(_f){
this.results_handlers[_f]=_e;
}else{
this.register_listener("onResults",_e);
}
},init:function(){
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
},handle_stat:function(_10){
this.stat_response=_10;
if(Playdar.USE_STATUS_BAR){
new Playdar.StatusBar();
Playdar.status_bar.handle_stat(_10);
}
this.listeners.onStat(_10);
if(_10.authenticated){
if(!Playdar.scrobbler&&Playdar.USE_SCROBBLER&&_10.capabilities.audioscrobbler){
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
return this.get_base_url("/auth_1/",this.auth_details);
},get_auth_link_html:function(_11){
_11=_11||"Connect";
var _12="<a href=\""+this.get_auth_url()+"\" target=\""+Playdar.AUTH_POPUP_NAME+"\" onclick=\"Playdar.client.start_auth(); return false;"+"\">"+_11+"</a>";
return _12;
},get_disconnect_link_html:function(_13){
_13=_13||"Disconnect";
var _14="<a href=\""+this.get_base_url("/settings/auth/")+"\" onclick=\"Playdar.client.clear_auth(); return false;"+"\">"+_13+"</a>";
return _14;
},start_auth:function(){
if(!this.auth_popup||this.auth_popup.closed){
this.auth_popup=window.open(this.get_auth_url(),Playdar.AUTH_POPUP_NAME,Playdar.Util.get_popup_options(Playdar.AUTH_POPUP_SIZE));
}else{
this.auth_popup.focus();
}
if(!this.auth_details.receiverurl){
if(Playdar.status_bar){
Playdar.status_bar.start_manual_auth();
}
}
},auth_callback:function(_15){
Playdar.Util.setcookie(Playdar.AUTH_COOKIE_NAME,_15,365);
if(this.auth_popup&&!this.auth_popup.closed){
this.auth_popup.close();
this.auth_popup=null;
}
this.auth_token=_15;
this.stat();
},manual_auth_callback:function(_16){
var _17=document.getElementById(_16);
if(_17&&_17.value){
this.auth_callback(_17.value);
}
},autodetect:function(_18,_19){
if(!this.is_authed()){
return false;
}
var qid,i,j,_1a,j,_1b;
try{
var mf=Playdar.Parse.microformats(_19);
var _1c=Playdar.Parse.rdfa(_19);
var _1d=mf.concat(_1c);
for(i=0;i<_1d.length;i++){
_1a=_1d[i];
for(j=0;j<_1a.tracks.length;j++){
_1b=_1a.tracks[j];
if(_18){
qid=_18(_1b);
}
this.resolve(_1b.artist,_1b.album,_1b.title,qid);
}
}
}
catch(error){
console.warn(error);
}
},resolve:function(_1e,_1f,_20,qid,url){
if(!this.is_authed()){
return false;
}
var _21={artist:_1e||"",album:_1f||"",track:_20||"",url:url||"",qid:qid||Playdar.Util.generate_uuid()};
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.resolution_queue.push(_21);
this.process_resolution_queue();
},process_resolution_queue:function(){
if(this.resolutions_in_progress.count>=Playdar.MAX_CONCURRENT_RESOLUTIONS){
return false;
}
var _22=this.resolution_queue.length+this.resolutions_in_progress.count;
if(_22){
var _23=Playdar.MAX_CONCURRENT_RESOLUTIONS-this.resolutions_in_progress.count;
for(var i=1;i<=_23;i++){
var _24=this.resolution_queue.shift();
if(!_24){
break;
}
this.resolutions_in_progress.queries[_24.qid]=_24;
this.resolutions_in_progress.count++;
Playdar.Util.loadjs(this.get_url("resolve","handle_resolution",_24));
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
var _25={qid:qid};
this.resolutions_in_progress.queries[qid]=_25;
this.resolutions_in_progress.count++;
this.handle_resolution(_25);
},handle_resolution:function(_26){
if(this.resolutions_in_progress.queries[_26.qid]){
this.last_qid=_26.qid;
this.resolve_qids.push(this.last_qid);
this.get_results(_26.qid);
}
},get_results:function(qid){
if(this.resolutions_in_progress.queries[qid]){
if(!this.poll_counts[qid]){
this.poll_counts[qid]=0;
}
this.poll_counts[qid]++;
Playdar.Util.loadjs(this.get_url("get_results","handle_results",{qid:qid,poll:this.poll_counts[qid]}));
}
},poll_results:function(_27,_28,_29){
var _2a=this.should_stop_polling(_27);
_29=_29||this;
if(!_2a){
setTimeout(function(){
_28.call(_29,_27.qid);
},_27.poll_interval||_27.refresh_interval);
}
return _2a;
},should_stop_polling:function(_2b){
if(_2b.poll_interval<=0||_2b.refresh_interval<=0){
return true;
}
if(_2b.query.solved==true){
return true;
}
if(this.poll_counts[_2b.qid]>=(_2b.poll_limit||Playdar.MAX_POLLS)){
return true;
}
return false;
},handle_results:function(_2c){
if(this.resolutions_in_progress.queries[_2c.qid]){
var _2d=this.poll_results(_2c,this.get_results);
if(Playdar.status_bar){
Playdar.status_bar.handle_results(_2c,_2d);
}
if(this.results_handlers[_2c.qid]){
this.results_handlers[_2c.qid](_2c,_2d);
}else{
this.listeners.onResults(_2c,_2d);
}
if(_2d){
delete this.resolutions_in_progress.queries[_2c.qid];
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
},get_base_url:function(_2e,_2f){
var url="http://"+Playdar.SERVER_ROOT+":"+Playdar.SERVER_PORT;
if(_2e){
url+=_2e;
}
if(_2f){
url+="?"+Playdar.Util.toQueryString(_2f);
}
return url;
},get_url:function(_30,_31,_32){
_32=_32||{};
_32.call_id=new Date().getTime();
_32.method=_30;
if(!_32.jsonp){
if(_31.join){
_32.jsonp=_31.join(".");
}else{
_32.jsonp=this.jsonp_callback(_31);
}
}
this.add_auth_token(_32);
return this.get_base_url("/api/",_32);
},add_auth_token:function(_33){
if(this.is_authed()){
_33.auth=this.auth_token;
}
return _33;
},get_stream_url:function(sid){
return this.get_base_url("/sid/"+sid);
},jsonp_callback:function(_34){
return "Playdar.client."+_34;
},list_results:function(_35){
for(var i=0;i<_35.results.length;i++){
console.log(_35.results[i].name);
}
}};
Playdar.Boffin=function(){
Playdar.boffin=this;
};
Playdar.Boffin.prototype={get_url:function(_36,_37){
_37=_37||{};
_37.call_id=new Date().getTime();
_37.jsonp=_37.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_37);
return Playdar.client.get_base_url("/boffin/"+_36,_37);
},get_tagcloud:function(){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
Playdar.Util.loadjs(this.get_url("tagcloud",{jsonp:"Playdar.boffin.handle_tagcloud"}));
},handle_tagcloud:function(_38){
Playdar.client.register_results_handler(Playdar.client.listeners.onTagCloud,_38.qid);
Playdar.client.get_results(_38.qid);
},get_tag_rql:function(tag){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
var rql="tag:\""+tag+"\"";
Playdar.Util.loadjs(this.get_url("rql/"+encodeURIComponent(rql),{jsonp:"Playdar.boffin.handle_rql"}));
},handle_rql:function(_39){
Playdar.client.register_results_handler(Playdar.client.listeners.onRQL,_39.qid);
Playdar.client.get_results(_39.qid);
}};
Playdar.Scrobbler=function(){
Playdar.scrobbler=this;
};
Playdar.Scrobbler.prototype={get_url:function(_3a,_3b){
_3b=_3b||{};
_3b.call_id=new Date().getTime();
_3b.jsonp=_3b.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_3b);
return Playdar.client.get_base_url("/audioscrobbler/"+_3a,_3b);
},start:function(_3c,_3d,_3e,_3f,_40,_41){
var _42={a:_3c,t:_3d,o:"P"};
if(_3e){
_42["b"]=_3e;
}
if(_3f){
_42["l"]=_3f;
}
if(_40){
_42["n"]=_40;
}
if(_41){
_42["m"]=_41;
}
Playdar.Util.loadjs(this.get_url("start",_42));
},stop:function(){
Playdar.Util.loadjs(this.get_url("stop"));
},pause:function(){
Playdar.Util.loadjs(this.get_url("pause"));
},resume:function(){
Playdar.Util.loadjs(this.get_url("resume"));
},get_sound_callbacks:function(_43){
var _44=this;
return {onload:function(){
if(this.readyState==2){
_44.stop();
this.unload();
}
},onplay:function(){
this.scrobbleStart=true;
},onpause:function(){
_44.pause();
},onresume:function(){
_44.resume();
},onfinish:function(){
if(!this.chained){
_44.stop();
}
},whileplaying:function(){
if(this.scrobbleStart){
this.scrobbleStart=false;
_44.start(_43.artist,_43.track,_43.album,_43.duration);
}
}};
}};
Playdar.Player=function(_45){
Playdar.player=this;
this.streams={};
this.nowplayingid=null;
this.soundmanager=_45;
};
Playdar.Player.MPEG4_MIMETYPES={"audio/mp4":true,"audio/aac":true,"audio/x-aac":true,"audio/x-m4a":true,"audio/x-m4b":true};
Playdar.Player.prototype={register_stream:function(_46,_47){
if(this.streams[_46.sid]){
return false;
}
this.streams[_46.sid]=_46;
var _48=Playdar.Util.extend_object({id:"s_"+_46.sid,url:Playdar.client.get_stream_url(_46.sid),isMovieStar:Playdar.Player.MPEG4_MIMETYPES[_46.mimetype]==true,bufferTime:2},_47);
var _49=[_47];
if(Playdar.status_bar){
_49.push(Playdar.status_bar.get_sound_callbacks(_46));
}
if(Playdar.scrobbler){
_49.push(Playdar.scrobbler.get_sound_callbacks(_46));
}
Playdar.Util.extend_object(_48,Playdar.Util.merge_callback_options(_49));
try{
var _4a=this.soundmanager.createSound(_48);
}
catch(e){
return false;
}
return _4a;
},play_stream:function(sid){
var _4b=this.soundmanager.getSoundById("s_"+sid);
if(this.nowplayingid!=sid){
this.stop_current();
if(_4b.playState==0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_4b.togglePause();
return _4b;
},stop_current:function(_4c){
if(_4c){
if(Playdar.scrobbler){
Playdar.scrobbler.stop();
}
}
if(this.nowplayingid){
var _4d=this.soundmanager.getSoundById("s_"+this.nowplayingid);
_4d.stop();
_4d.setPosition(1);
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
var _4e=document.createElement("div");
_4e.style.position="fixed";
_4e.style.bottom=0;
_4e.style.left=0;
_4e.style.zIndex=100;
_4e.style.width="100%";
_4e.style.height="36px";
_4e.style.padding="7px 0";
_4e.style.borderTop="2px solid #4c7a0f";
_4e.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_4e.style.color="#335507";
_4e.style.background="#e8f9bb";
var _4f=document.createElement("div");
_4f.style.padding="0 7px";
var _50="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_4f.innerHTML=_50;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_4f.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _51=document.createElement("p");
_51.style.margin="0";
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
_51.appendChild(this.track_link);
this.playback.appendChild(_51);
var _52=document.createElement("table");
_52.setAttribute("cellpadding",0);
_52.setAttribute("cellspacing",0);
_52.setAttribute("border",0);
_52.style.color="#4c7a0f";
_52.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _53=document.createElement("tbody");
var _54=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_54.appendChild(this.track_elapsed);
var _55=document.createElement("td");
_55.style.padding="0 5px";
_55.style.verticalAlign="middle";
var _56=document.createElement("div");
_56.style.width=this.progress_bar_width+"px";
_56.style.height="9px";
_56.style.border="1px solid #4c7a0f";
_56.style.background="#fff";
_56.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_56.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_56.appendChild(this.playhead);
_56.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_55.appendChild(_56);
_54.appendChild(_55);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_54.appendChild(this.track_duration);
_53.appendChild(_54);
_52.appendChild(_53);
this.playback.appendChild(_52);
_4f.appendChild(this.playback);
var _57=document.createElement("div");
_57.style.cssFloat="right";
_57.style.padding="0 8px";
_57.style.textAlign="right";
var _58=document.createElement("p");
_58.style.margin=0;
_58.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_57.appendChild(_58);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML=Playdar.client.get_disconnect_link_html();
_57.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_4e.appendChild(_57);
_4e.appendChild(_4f);
document.body.appendChild(_4e);
var _59=document.body.style.marginBottom;
if(!_59){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_59=css.marginBottom;
}
}
document.body.style.marginBottom=(_59.replace("px","")-0)+36+(7*2)+2+"px";
return _4e;
},ready:function(){
this.playdar_links.style.display="";
var _5a="Ready";
this.status.innerHTML=_5a;
},offline:function(){
this.playdar_links.style.display="none";
var _5b=Playdar.client.get_auth_link_html();
this.status.innerHTML=_5b;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _5c="manualAuth_"+Playdar.client.uuid;
var _5d="<input type=\"text\" id=\""+_5c+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_5c+"'); return false;"+"\" />";
this.status.innerHTML=_5d;
},handle_stat:function(_5e){
if(_5e.authenticated){
this.ready();
}else{
this.offline();
}
},get_queries_popup_url:function(){
return Playdar.STATIC_HOST+"/demos/tracks.html";
},open_queries_popup:function(){
if(this.queries_popup===null||this.queries_popup.closed){
this.queries_popup=window.open(this.get_queries_popup_url(),Playdar.QUERIES_POPUP_NAME,Playdar.Util.get_popup_options(Playdar.QUERIES_POPUP_SIZE));
}else{
this.queries_popup.focus();
}
},show_resolution_status:function(){
if(this.query_count){
var _5f=" ";
if(this.pending_count){
_5f+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_5f+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_5f;
}
},handle_results:function(_60,_61){
if(_61){
this.pending_count--;
if(_60.results.length){
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
},get_sound_callbacks:function(_62){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
}};
},play_handler:function(_63){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_63.sid);
this.track_link.title=_63.source;
this.track_name.innerHTML=_63.track;
this.artist_name.innerHTML=_63.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_63.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_64){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_64.position/1000));
var _65;
if(_64.readyState==3){
_65=_64.duration;
}else{
_65=_64.durationEstimate;
}
var _66=_64.position/_65;
this.playhead.style.width=Math.round(_66*this.progress_bar_width)+"px";
this.loading_handler(_64);
},loading_handler:function(_67){
var _68=_67.bytesLoaded/_67.bytesTotal;
this.bufferhead.style.width=Math.round(_68*this.progress_bar_width)+"px";
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
var _69="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _6a=[];
var rnd=Math.random;
var r;
_6a[8]=_6a[13]=_6a[18]=_6a[23]="-";
_6a[14]="4";
for(var i=0;i<36;i++){
if(!_6a[i]){
r=0|rnd()*16;
_6a[i]=_69[(i==19)?(r&3)|8:r&15];
}
}
return _6a.join("");
},toQueryPair:function(key,_6b){
if(_6b===null){
return key;
}
return key+"="+encodeURIComponent(_6b);
},toQueryString:function(_6c){
var _6d=[];
for(var key in _6c){
var _6e=_6c[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_6e)=="[object Array]"){
for(var i=0;i<_6e.length;i++){
_6d.push(Playdar.Util.toQueryPair(key,_6e[i]));
}
}else{
_6d.push(Playdar.Util.toQueryPair(key,_6e));
}
}
return _6d.join("&");
},mmss:function(_6f){
var s=_6f%60;
if(s<10){
s="0"+s;
}
return Math.floor(_6f/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_70,_71,_72){
if(_72){
var _73=new Date();
_73.setTime(_73.getTime()+(_72*24*60*60*1000));
var _74="; expires="+_73.toGMTString();
}else{
var _74="";
}
document.cookie=_70+"="+_71+_74+"; path=/";
},getcookie:function(_75){
var _76=_75+"=";
var _77=document.cookie.split(";");
for(var i=0;i<_77.length;i++){
var c=_77[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_76)==0){
return c.substring(_76.length,c.length);
}
}
return null;
},deletecookie:function(_78){
Playdar.Util.setcookie(_78,"",-1);
},get_window_position:function(){
var _79={};
if(window.screenLeft){
_79.x=window.screenLeft||0;
_79.y=window.screenTop||0;
}else{
_79.x=window.screenX||0;
_79.y=window.screenY||0;
}
return _79;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_7a){
var _7b=Playdar.Util.get_popup_location(_7a);
return ["left="+_7b.x,"top="+_7b.y,"width="+_7a.w,"height="+_7a.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_7c){
var _7d=Playdar.Util.get_window_position();
var _7e=Playdar.Util.get_window_size();
return {"x":Math.max(0,_7d.x+(_7e.w-_7c.w)/2),"y":Math.max(0,_7d.y+(_7e.h-_7c.h)/2)};
},addEvent:function(obj,_7f,fn){
if(obj.attachEvent){
obj["e"+_7f+fn]=fn;
obj[_7f+fn]=function(){
obj["e"+_7f+fn](window.event);
};
obj.attachEvent("on"+_7f,obj[_7f+fn]);
}else{
obj.addEventListener(_7f,fn,false);
}
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_80,_81){
_81=_81||{};
for(var _82 in _81){
_80[_82]=_81[_82];
}
return _80;
},merge_callback_options:function(_83){
var _84={};
var _85=[];
var i,_86,_87;
for(i=0;i<_83.length;i++){
_86=_83[i];
for(_87 in _86){
if(typeof (_86[_87])=="function"){
if(!_84[_87]){
_85.push(_87);
_84[_87]=[];
}
_84[_87].push(_86);
}
}
}
var _88={};
var key,_89;
for(i=0;i<_85.length;i++){
var key=_85[i];
_88[key]=(function(key,_8a){
return function(){
for(var j=0;j<_8a.length;j++){
_8a[j][key].apply(this,arguments);
}
};
})(key,_84[key]);
}
return _88;
},log:function(_8b){
if(typeof console!="undefined"){
console.dir(_8b);
}
},null_callback:function(){
}};
Playdar.Parse={getProperty:function(_8c,_8d){
var _8d=_8d||"innerHTML";
var i,_8e,_8f;
for(i=0;i<_8c.length;i++){
_8e=_8c[i];
_8f=_8e[_8d]||_8e.getAttribute(_8d);
if(_8f){
return _8f;
}
}
return;
},getValue:function(_90){
var i,_91,_92;
for(i=0;i<_90.length;i++){
_91=_90[i];
_92=Playdar.Util.select(".value",_91);
if(_92.length){
return Playdar.Parse.getContentWithoutValue(_92);
}
}
return;
},getContentWithoutValue:function(_93){
return Playdar.Parse.getProperty(_93,"content")||Playdar.Parse.getProperty(_93,"title")||Playdar.Parse.getProperty(_93);
},getContent:function(_94){
var _95=Playdar.Parse.getValue(_94)||Playdar.Parse.getContentWithoutValue(_94);
if(_95){
return _95.replace(/(^\s*)|(\s*$)/g,"");
}
return;
},getPosition:function(_96){
var _97=_96;
var _98=0;
if(_96.nodeName=="LI"&&_96.parentNode.nodeName=="OL"){
while(_97.previousSibling){
_97=_97.previousSibling;
if(_97.nodeName=="LI"){
_98++;
}
}
return _98+1;
}
return;
},microformats:function(_99){
var sel=Playdar.Util.select;
function _9a(_9b,_9c){
return sel(_9b+":not(.item "+_9b+")",_9c);
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
var i,_af,_b0,_b1,_b2,_b3,_b4,_ad;
for(i=0;i<_ae.length;i++){
if(!_ae[i].playdarParsed){
_af=Playdar.Parse.getContent(_9a(".album",_ae[i]));
if(!_af){
continue;
}
_b1={type:"album",title:_af,artist:_a7(_ae[i]),image:Playdar.Parse.getProperty(_9a(".photo",_ae[i]),"src")||Playdar.Parse.getProperty(_9a(".photo",_ae[i]),"href"),download:Playdar.Parse.getProperty(_9a("[rel~=enclosure]",_ae[i]),"href"),released:Playdar.Parse.getContent(_9a(".published",_ae[i])),duration:Playdar.Parse.getContent(_9a(".duration",_ae[i])),buy:_9d(_ae[i])};
_b1.tracks=_a1(sel(".item",_ae[i]),_b1.artist,_af);
_ad.push(_b1);
_ae[i].playdarParsed=true;
}
}
return _ad;
};
function _b5(_b6){
var _b7=_ab(_b6);
var _b8=_a1(sel(".haudio"));
if(_b8.length){
_b7.push({type:"page",title:window.title||window.location.href,tracks:_b8});
}
return _b7;
};
var _b9=_b5(_99);
return _b9;
},rdfa:function(_ba){
var sel=Playdar.Util.select;
function _bb(_bc,_bd,_be){
return sel(_bc+":not("+_bd+" "+_bc+")",_be);
};
function _bf(_c0,_c1){
return sel(_c0+":not([typeof="+_c2+":Recording] "+_c0+")",_c1);
};
function _c3(_c4,url){
for(var i=0;i<_c4.attributes.length;i++){
var _c5=_c4.attributes[i];
if(_c5.nodeValue==url){
return _c5.nodeName.replace("xmlns:","");
}
}
};
var _c6=sel("html")[0];
var _c7=_c3(_c6,"http://purl.org/commerce#");
var _c2=_c3(_c6,"http://purl.org/media/audio#");
var _c8=_c3(_c6,"http://purl.org/media#");
var _c9=_c3(_c6,"http://purl.org/dc/terms/");
var _ca=_c3(_c6,"http://xmlns.com/foaf/0.1/");
function _cb(_cc,rec){
var _cd=rec?sel:_bf;
var _ce=Playdar.Parse.getProperty(_cd("[rel~="+_c7+":payment]",_cc),"href");
if(!_ce){
return;
}
return {url:_ce,currency:Playdar.Parse.getContent(_cd("[rel~="+_c7+":costs] [property="+_c7+":currency]",_cc)),amount:Playdar.Parse.getContent(_cd("[rel~="+_c7+":costs] [property="+_c7+":amount]",_cc))};
};
function _cf(_d0,_d1,_d2){
var _d3=[];
var _d4=_bf("[typeof="+_c2+":Recording]",_d0);
var i,_d5;
for(i=0;i<_d4.length;i++){
if(!_d4[i].playdarParsed){
_d5={title:Playdar.Parse.getContent(sel("[property="+_c9+":title]",_d4[i])),artist:Playdar.Parse.getContent(sel("[property="+_c9+":creator]",_d4[i]))||_d1,album:_d2,position:Playdar.Parse.getContent(sel("[property="+_c8+":position]",_d4[i]))||Playdar.Parse.getPosition(_d4[i]),duration:Playdar.Parse.getContent(sel("[property="+_c8+":duration]",_d4[i]))||Playdar.Parse.getContent(sel("[property="+_c9+":duration]",_d4[i])),buy:_cb(_d4[i],true),element:_d4[i]};
_d3.push(_d5);
_d4[i].playdarParsed=true;
}
}
return _d3;
};
function _d6(_d7){
var _d8=_bf("[property="+_c9+":creator]",_d7);
var _d9;
if(_d8.length){
_d9=Playdar.Parse.getContent(sel("[property="+_ca+":name]",_d8[0]));
}
if(!_d9){
var _da=sel("[rel~="+_c9+":creator]",_d7);
var _db=Playdar.Parse.getProperty(_da,"resource");
if(_db){
var _dc=sel("[about="+_db+"]");
_d9=Playdar.Parse.getContent(sel("[property="+_ca+":name]",_dc[0]))||Playdar.Parse.getContent(_dc);
}
}
if(!_d9){
_d9=Playdar.Parse.getContent(_d8);
}
return _d9;
};
function _dd(_de){
var _df=[];
var _e0=sel("[typeof="+_c2+":Album]",_de);
var i,_e1,_e2;
for(i=0;i<_e0.length;i++){
if(!_e0[i].playdarParsed){
_e1={type:"album",title:Playdar.Parse.getContent(_bf("[property="+_c9+":title]",_e0[i])),artist:_d6(_e0[i]),image:Playdar.Parse.getProperty(_bf("[rel~="+_c8+":depiction]",_e0[i]),"src")||Playdar.Parse.getProperty(_bf("[rev~="+_c8+":depiction]",_e0[i]),"src"),download:Playdar.Parse.getProperty(_bf("[rel~="+_c8+":download]",_e0[i]),"href"),released:Playdar.Parse.getContent(_bf("[property="+_c9+":issued]",_e0[i]))||Playdar.Parse.getContent(_bf("[property="+_c9+":published]",_e0[i]))||Playdar.Parse.getContent(_bf("[property="+_c9+":date]",_e0[i])),duration:Playdar.Parse.getContent(_bf("[property="+_c8+":duration]",_e0[i]))||Playdar.Parse.getContent(_bf("[property="+_c9+":duration]",_e0[i])),buy:_cb(_e0[i])};
_e1.tracks=_cf(_e0[i],_e1.artist,_e1.title);
_df.push(_e1);
_e0[i].playdarParsed=true;
}
}
return _df;
};
function _e3(_e4){
var _e5=_dd(_e4);
var _e6=_cf(_e4);
if(_e6.length){
_e5.push({type:"page",title:window.title||window.location.href,tracks:_e6});
}
return _e5;
};
var _e7=_e3(_ba);
return _e7;
}};
Playdar.Util.addEvent(window,"beforeunload",Playdar.unload);
(function(){
var _e8=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_e9=0,_ea=Object.prototype.toString,_eb=false;
var _ec=function(_ed,_ee,_ef,_f0){
_ef=_ef||[];
var _f1=_ee=_ee||document;
if(_ee.nodeType!==1&&_ee.nodeType!==9){
return [];
}
if(!_ed||typeof _ed!=="string"){
return _ef;
}
var _f2=[],m,set,_f3,_f4,_f5,_f6,_f7=true,_f8=_f9(_ee);
_e8.lastIndex=0;
while((m=_e8.exec(_ed))!==null){
_f2.push(m[1]);
if(m[2]){
_f6=RegExp.rightContext;
break;
}
}
if(_f2.length>1&&_fa.exec(_ed)){
if(_f2.length===2&&_fb.relative[_f2[0]]){
set=_fc(_f2[0]+_f2[1],_ee);
}else{
set=_fb.relative[_f2[0]]?[_ee]:_ec(_f2.shift(),_ee);
while(_f2.length){
_ed=_f2.shift();
if(_fb.relative[_ed]){
_ed+=_f2.shift();
}
set=_fc(_ed,set);
}
}
}else{
if(!_f0&&_f2.length>1&&_ee.nodeType===9&&!_f8&&_fb.match.ID.test(_f2[0])&&!_fb.match.ID.test(_f2[_f2.length-1])){
var ret=_ec.find(_f2.shift(),_ee,_f8);
_ee=ret.expr?_ec.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_ee){
var ret=_f0?{expr:_f2.pop(),set:_fd(_f0)}:_ec.find(_f2.pop(),_f2.length===1&&(_f2[0]==="~"||_f2[0]==="+")&&_ee.parentNode?_ee.parentNode:_ee,_f8);
set=ret.expr?_ec.filter(ret.expr,ret.set):ret.set;
if(_f2.length>0){
_f3=_fd(set);
}else{
_f7=false;
}
while(_f2.length){
var cur=_f2.pop(),pop=cur;
if(!_fb.relative[cur]){
cur="";
}else{
pop=_f2.pop();
}
if(pop==null){
pop=_ee;
}
_fb.relative[cur](_f3,pop,_f8);
}
}else{
_f3=_f2=[];
}
}
if(!_f3){
_f3=set;
}
if(!_f3){
throw "Syntax error, unrecognized expression: "+(cur||_ed);
}
if(_ea.call(_f3)==="[object Array]"){
if(!_f7){
_ef.push.apply(_ef,_f3);
}else{
if(_ee&&_ee.nodeType===1){
for(var i=0;_f3[i]!=null;i++){
if(_f3[i]&&(_f3[i]===true||_f3[i].nodeType===1&&_fe(_ee,_f3[i]))){
_ef.push(set[i]);
}
}
}else{
for(var i=0;_f3[i]!=null;i++){
if(_f3[i]&&_f3[i].nodeType===1){
_ef.push(set[i]);
}
}
}
}
}else{
_fd(_f3,_ef);
}
if(_f6){
_ec(_f6,_f1,_ef,_f0);
_ec.uniqueSort(_ef);
}
return _ef;
};
_ec.uniqueSort=function(_ff){
if(_100){
_eb=false;
_ff.sort(_100);
if(_eb){
for(var i=1;i<_ff.length;i++){
if(_ff[i]===_ff[i-1]){
_ff.splice(i--,1);
}
}
}
}
};
_ec.matches=function(expr,set){
return _ec(expr,null,null,set);
};
_ec.find=function(expr,_101,_102){
var set,_103;
if(!expr){
return [];
}
for(var i=0,l=_fb.order.length;i<l;i++){
var type=_fb.order[i],_103;
if((_103=_fb.match[type].exec(expr))){
var left=RegExp.leftContext;
if(left.substr(left.length-1)!=="\\"){
_103[1]=(_103[1]||"").replace(/\\/g,"");
set=_fb.find[type](_103,_101,_102);
if(set!=null){
expr=expr.replace(_fb.match[type],"");
break;
}
}
}
}
if(!set){
set=_101.getElementsByTagName("*");
}
return {set:set,expr:expr};
};
_ec.filter=function(expr,set,_104,not){
var old=expr,_105=[],_106=set,_107,_108,_109=set&&set[0]&&_f9(set[0]);
while(expr&&set.length){
for(var type in _fb.filter){
if((_107=_fb.match[type].exec(expr))!=null){
var _10a=_fb.filter[type],_10b,item;
_108=false;
if(_106==_105){
_105=[];
}
if(_fb.preFilter[type]){
_107=_fb.preFilter[type](_107,_106,_104,_105,not,_109);
if(!_107){
_108=_10b=true;
}else{
if(_107===true){
continue;
}
}
}
if(_107){
for(var i=0;(item=_106[i])!=null;i++){
if(item){
_10b=_10a(item,_107,i,_106);
var pass=not^!!_10b;
if(_104&&_10b!=null){
if(pass){
_108=true;
}else{
_106[i]=false;
}
}else{
if(pass){
_105.push(item);
_108=true;
}
}
}
}
}
if(_10b!==undefined){
if(!_104){
_106=_105;
}
expr=expr.replace(_fb.match[type],"");
if(!_108){
return [];
}
break;
}
}
}
if(expr==old){
if(_108==null){
throw "Syntax error, unrecognized expression: "+expr;
}else{
break;
}
}
old=expr;
}
return _106;
};
var _fb=_ec.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(elem){
return elem.getAttribute("href");
}},relative:{"+":function(_10c,part,_10d){
var _10e=typeof part==="string",_10f=_10e&&!(/\W/).test(part),_110=_10e&&!_10f;
if(_10f&&!_10d){
part=part.toUpperCase();
}
for(var i=0,l=_10c.length,elem;i<l;i++){
if((elem=_10c[i])){
while((elem=elem.previousSibling)&&elem.nodeType!==1){
}
_10c[i]=_110||elem&&elem.nodeName===part?elem||false:elem===part;
}
}
if(_110){
_ec.filter(part,_10c,true);
}
},">":function(_111,part,_112){
var _113=typeof part==="string";
if(_113&&!(/\W/).test(part)){
part=_112?part:part.toUpperCase();
for(var i=0,l=_111.length;i<l;i++){
var elem=_111[i];
if(elem){
var _114=elem.parentNode;
_111[i]=_114.nodeName===part?_114:false;
}
}
}else{
for(var i=0,l=_111.length;i<l;i++){
var elem=_111[i];
if(elem){
_111[i]=_113?elem.parentNode:elem.parentNode===part;
}
}
if(_113){
_ec.filter(part,_111,true);
}
}
},"":function(_115,part,_116){
var _117=_e9++,_118=_119;
if(!part.match(/\W/)){
var _11a=part=_116?part:part.toUpperCase();
_118=_11b;
}
_118("parentNode",part,_117,_115,_11a,_116);
},"~":function(_11c,part,_11d){
var _11e=_e9++,_11f=_119;
if(typeof part==="string"&&!part.match(/\W/)){
var _120=part=_11d?part:part.toUpperCase();
_11f=_11b;
}
_11f("previousSibling",part,_11e,_11c,_120,_11d);
}},find:{ID:function(_121,_122,_123){
if(typeof _122.getElementById!=="undefined"&&!_123){
var m=_122.getElementById(_121[1]);
return m?[m]:[];
}
},NAME:function(_124,_125,_126){
if(typeof _125.getElementsByName!=="undefined"){
var ret=[],_127=_125.getElementsByName(_124[1]);
for(var i=0,l=_127.length;i<l;i++){
if(_127[i].getAttribute("name")===_124[1]){
ret.push(_127[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_128,_129){
return _129.getElementsByTagName(_128[1]);
}},preFilter:{CLASS:function(_12a,_12b,_12c,_12d,not,_12e){
_12a=" "+_12a[1].replace(/\\/g,"")+" ";
if(_12e){
return _12a;
}
for(var i=0,elem;(elem=_12b[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_12a)>=0)){
if(!_12c){
_12d.push(elem);
}
}else{
if(_12c){
_12b[i]=false;
}
}
}
}
return false;
},ID:function(_12f){
return _12f[1].replace(/\\/g,"");
},TAG:function(_130,_131){
for(var i=0;_131[i]===false;i++){
}
return _131[i]&&_f9(_131[i])?_130[1]:_130[1].toUpperCase();
},CHILD:function(_132){
if(_132[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_132[2]=="even"&&"2n"||_132[2]=="odd"&&"2n+1"||!(/\D/).test(_132[2])&&"0n+"+_132[2]||_132[2]);
_132[2]=(test[1]+(test[2]||1))-0;
_132[3]=test[3]-0;
}
_132[0]=_e9++;
return _132;
},ATTR:function(_133,_134,_135,_136,not,_137){
var name=_133[1].replace(/\\/g,"");
if(!_137&&_fb.attrMap[name]){
_133[1]=_fb.attrMap[name];
}
if(_133[2]==="~="){
_133[4]=" "+_133[4]+" ";
}
return _133;
},PSEUDO:function(_138,_139,_13a,_13b,not){
if(_138[1]==="not"){
if(_138[3].match(_e8).length>1||(/^\w/).test(_138[3])){
_138[3]=_ec(_138[3],null,null,_139);
}else{
var ret=_ec.filter(_138[3],_139,_13a,true^not);
if(!_13a){
_13b.push.apply(_13b,ret);
}
return false;
}
}else{
if(_fb.match.POS.test(_138[0])||_fb.match.CHILD.test(_138[0])){
return true;
}
}
return _138;
},POS:function(_13c){
_13c.unshift(true);
return _13c;
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
},has:function(elem,i,_13d){
return !!_ec(_13d[3],elem).length;
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
},last:function(elem,i,_13e,_13f){
return i===_13f.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_140){
return i<_140[3]-0;
},gt:function(elem,i,_141){
return i>_141[3]-0;
},nth:function(elem,i,_142){
return _142[3]-0==i;
},eq:function(elem,i,_143){
return _143[3]-0==i;
}},filter:{PSEUDO:function(elem,_144,i,_145){
var name=_144[1],_146=_fb.filters[name];
if(_146){
return _146(elem,i,_144,_145);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_144[3])>=0;
}else{
if(name==="not"){
var not=_144[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_147){
var type=_147[1],node=elem;
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
var _148=_147[2],last=_147[3];
if(_148==1&&last==0){
return true;
}
var _149=_147[0],_14a=elem.parentNode;
if(_14a&&(_14a.sizcache!==_149||!elem.nodeIndex)){
var _14b=0;
for(node=_14a.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_14b;
}
}
_14a.sizcache=_149;
}
var diff=elem.nodeIndex-last;
if(_148==0){
return diff==0;
}else{
return (diff%_148==0&&diff/_148>=0);
}
}
},ID:function(elem,_14c){
return elem.nodeType===1&&elem.getAttribute("id")===_14c;
},TAG:function(elem,_14d){
return (_14d==="*"&&elem.nodeType===1)||elem.nodeName===_14d;
},CLASS:function(elem,_14e){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_14e)>-1;
},ATTR:function(elem,_14f){
var name=_14f[1],_150=_fb.attrHandle[name]?_fb.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_151=_150+"",type=_14f[2],_152=_14f[4];
return _150==null?type==="!=":type==="="?_151===_152:type==="*="?_151.indexOf(_152)>=0:type==="~="?(" "+_151+" ").indexOf(_152)>=0:!_152?_151&&_150!==false:type==="!="?_151!=_152:type==="^="?_151.indexOf(_152)===0:type==="$="?_151.substr(_151.length-_152.length)===_152:type==="|="?_151===_152||_151.substr(0,_152.length+1)===_152+"-":false;
},POS:function(elem,_153,i,_154){
var name=_153[2],_155=_fb.setFilters[name];
if(_155){
return _155(elem,i,_153,_154);
}
}}};
var _fa=_fb.match.POS;
for(var type in _fb.match){
_fb.match[type]=new RegExp(_fb.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _fd=function(_156,_157){
_156=Array.prototype.slice.call(_156);
if(_157){
_157.push.apply(_157,_156);
return _157;
}
return _156;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_fd=function(_158,_159){
var ret=_159||[];
if(_ea.call(_158)==="[object Array]"){
Array.prototype.push.apply(ret,_158);
}else{
if(typeof _158.length==="number"){
for(var i=0,l=_158.length;i<l;i++){
ret.push(_158[i]);
}
}else{
for(var i=0;_158[i];i++){
ret.push(_158[i]);
}
}
}
return ret;
};
}
var _100;
if(document.documentElement.compareDocumentPosition){
_100=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_eb=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_100=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_eb=true;
}
return ret;
};
}else{
if(document.createRange){
_100=function(a,b){
var _15a=a.ownerDocument.createRange(),_15b=b.ownerDocument.createRange();
_15a.selectNode(a);
_15a.collapse(true);
_15b.selectNode(b);
_15b.collapse(true);
var ret=_15a.compareBoundaryPoints(Range.START_TO_END,_15b);
if(ret===0){
_eb=true;
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
_fb.find.ID=function(_15c,_15d,_15e){
if(typeof _15d.getElementById!=="undefined"&&!_15e){
var m=_15d.getElementById(_15c[1]);
return m?m.id===_15c[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_15c[1]?[m]:undefined:[];
}
};
_fb.filter.ID=function(elem,_15f){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_15f;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_fb.find.TAG=function(_160,_161){
var _162=_161.getElementsByTagName(_160[1]);
if(_160[1]==="*"){
var tmp=[];
for(var i=0;_162[i];i++){
if(_162[i].nodeType===1){
tmp.push(_162[i]);
}
}
_162=tmp;
}
return _162;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_fb.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _163=_ec,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_ec=function(_164,_165,_166,seed){
_165=_165||document;
if(!seed&&_165.nodeType===9&&!_f9(_165)){
try{
return _fd(_165.querySelectorAll(_164),_166);
}
catch(e){
}
}
return _163(_164,_165,_166,seed);
};
for(var prop in _163){
_ec[prop]=_163[prop];
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
_fb.order.splice(1,0,"CLASS");
_fb.find.CLASS=function(_167,_168,_169){
if(typeof _168.getElementsByClassName!=="undefined"&&!_169){
return _168.getElementsByClassName(_167[1]);
}
};
})();
}
function _11b(dir,cur,_16a,_16b,_16c,_16d){
var _16e=dir=="previousSibling"&&!_16d;
for(var i=0,l=_16b.length;i<l;i++){
var elem=_16b[i];
if(elem){
if(_16e&&elem.nodeType===1){
elem.sizcache=_16a;
elem.sizset=i;
}
elem=elem[dir];
var _16f=false;
while(elem){
if(elem.sizcache===_16a){
_16f=_16b[elem.sizset];
break;
}
if(elem.nodeType===1&&!_16d){
elem.sizcache=_16a;
elem.sizset=i;
}
if(elem.nodeName===cur){
_16f=elem;
break;
}
elem=elem[dir];
}
_16b[i]=_16f;
}
}
};
function _119(dir,cur,_170,_171,_172,_173){
var _174=dir=="previousSibling"&&!_173;
for(var i=0,l=_171.length;i<l;i++){
var elem=_171[i];
if(elem){
if(_174&&elem.nodeType===1){
elem.sizcache=_170;
elem.sizset=i;
}
elem=elem[dir];
var _175=false;
while(elem){
if(elem.sizcache===_170){
_175=_171[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_173){
elem.sizcache=_170;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_175=true;
break;
}
}else{
if(_ec.filter(cur,[elem]).length>0){
_175=elem;
break;
}
}
}
elem=elem[dir];
}
_171[i]=_175;
}
}
};
var _fe=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _f9=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _fc=function(_176,_177){
var _178=[],_179="",_17a,root=_177.nodeType?[_177]:_177;
while((_17a=_fb.match.PSEUDO.exec(_176))){
_179+=_17a[0];
_176=_176.replace(_fb.match.PSEUDO,"");
}
_176=_fb.relative[_176]?_176+"*":_176;
for(var i=0,l=root.length;i<l;i++){
_ec(_176,root[i],_178);
}
return _ec.filter(_179,_178);
};
Playdar.Util.select=_ec;
})();

