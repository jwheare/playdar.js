Playdar={VERSION:"0.4.6",SERVER_ROOT:"localhost",SERVER_PORT:"60210",STATIC_HOST:"http://www.playdar.org",STAT_TIMEOUT:2000,AUTH_COOKIE_NAME:"Playdar.Auth",AUTH_POPUP_NAME:"Playdar.AuthPopup",AUTH_POPUP_SIZE:{"w":500,"h":260},QUERIES_POPUP_NAME:"Playdar.QueriesPopup",QUERIES_POPUP_SIZE:{"w":640,"h":700},MAX_POLLS:4,MAX_CONCURRENT_RESOLUTIONS:5,USE_STATUS_BAR:true,USE_SCROBBLER:true,client:null,status_bar:null,player:null,setup:function(_1){
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
var _14="<a href=\""+this.get_revoke_url()+"\" onclick=\"Playdar.client.clear_auth(); return false;"+"\">"+_13+"</a>";
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
return _1d;
}
catch(error){
console.warn(error);
}
},resolve:function(_1e,_1f,_20,qid,url){
if(!this.is_authed()){
return false;
}
var _21={artist:_1e||"",album:_1f||"",track:_20||"",url:url||"",qid:qid||Playdar.Util.generate_uuid()};
if(Playdar.player){
_21.mimetypes=Playdar.player.get_mime_types().join(",");
}
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
Playdar.Player.MIMETYPES={"audio/mpeg":false,"audio/aac":true,"audio/x-aac":true,"audio/flv":true,"audio/mov":true,"audio/mp4":true,"audio/m4v":true,"audio/f4v":true,"audio/m4a":true,"audio/x-m4a":true,"audio/x-m4b":true,"audio/mp4v":true,"audio/3gp":true,"audio/3g2":true};
Playdar.Player.prototype={get_mime_types:function(){
var _46=[];
for(type in Playdar.Player.MIMETYPES){
_46.push(type);
}
return _46;
},register_stream:function(_47,_48){
if(this.streams[_47.sid]){
return false;
}
this.streams[_47.sid]=_47;
var _49=Playdar.Util.extend_object({id:"s_"+_47.sid,url:Playdar.client.get_stream_url(_47.sid),isMovieStar:Playdar.Player.MIMETYPES[_47.mimetype]===true,bufferTime:2},_48);
var _4a=[_48];
if(Playdar.status_bar){
_4a.push(Playdar.status_bar.get_sound_callbacks(_47));
}
if(Playdar.scrobbler){
_4a.push(Playdar.scrobbler.get_sound_callbacks(_47));
}
Playdar.Util.extend_object(_49,Playdar.Util.merge_callback_options(_4a));
try{
var _4b=this.soundmanager.createSound(_49);
}
catch(e){
return false;
}
return _4b;
},play_stream:function(sid){
var _4c=this.soundmanager.getSoundById("s_"+sid);
if(this.nowplayingid!=sid){
this.stop_current();
if(_4c.playState==0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_4c.togglePause();
return _4c;
},stop_current:function(_4d){
if(_4d){
if(Playdar.scrobbler){
Playdar.scrobbler.stop();
}
}
if(this.nowplayingid){
var _4e=this.soundmanager.getSoundById("s_"+this.nowplayingid);
_4e.stop();
_4e.setPosition(1);
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
var _4f=document.createElement("div");
_4f.style.position="fixed";
_4f.style.bottom=0;
_4f.style.left=0;
_4f.style.zIndex=100;
_4f.style.width="100%";
_4f.style.height="36px";
_4f.style.padding="7px 0";
_4f.style.borderTop="2px solid #4c7a0f";
_4f.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_4f.style.color="#335507";
_4f.style.background="#e8f9bb";
var _50=document.createElement("div");
_50.style.padding="0 7px";
var _51="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_50.innerHTML=_51;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_50.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _52=document.createElement("p");
_52.style.margin="0";
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
_52.appendChild(this.track_link);
this.playback.appendChild(_52);
var _53=document.createElement("table");
_53.setAttribute("cellpadding",0);
_53.setAttribute("cellspacing",0);
_53.setAttribute("border",0);
_53.style.color="#4c7a0f";
_53.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _54=document.createElement("tbody");
var _55=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_55.appendChild(this.track_elapsed);
var _56=document.createElement("td");
_56.style.padding="0 5px";
_56.style.verticalAlign="middle";
var _57=document.createElement("div");
_57.style.width=this.progress_bar_width+"px";
_57.style.height="9px";
_57.style.border="1px solid #4c7a0f";
_57.style.background="#fff";
_57.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_57.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_57.appendChild(this.playhead);
_57.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_56.appendChild(_57);
_55.appendChild(_56);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_55.appendChild(this.track_duration);
_54.appendChild(_55);
_53.appendChild(_54);
this.playback.appendChild(_53);
_50.appendChild(this.playback);
var _58=document.createElement("div");
_58.style.cssFloat="right";
_58.style.padding="0 8px";
_58.style.textAlign="right";
var _59=document.createElement("p");
_59.style.margin=0;
_59.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_58.appendChild(_59);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML=Playdar.client.get_disconnect_link_html();
_58.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_4f.appendChild(_58);
_4f.appendChild(_50);
document.body.appendChild(_4f);
var _5a=document.body.style.marginBottom;
if(!_5a){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_5a=css.marginBottom;
}
}
document.body.style.marginBottom=(_5a.replace("px","")-0)+36+(7*2)+2+"px";
return _4f;
},ready:function(){
this.playdar_links.style.display="";
var _5b="Ready";
this.status.innerHTML=_5b;
},offline:function(){
this.playdar_links.style.display="none";
var _5c=Playdar.client.get_auth_link_html();
this.status.innerHTML=_5c;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _5d="manualAuth_"+Playdar.client.uuid;
var _5e="<form>"+"<input type=\"text\" id=\""+_5d+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_5d+"'); return false;"+"\" />"+"</form>";
this.status.innerHTML=_5e;
},handle_stat:function(_5f){
if(_5f.authenticated){
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
var _60=" ";
if(this.pending_count){
_60+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_60+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_60;
}
},handle_results:function(_61,_62){
if(_62){
this.pending_count--;
if(_61.results.length){
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
},get_sound_callbacks:function(_63){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
}};
},play_handler:function(_64){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_64.sid);
this.track_link.title=_64.source;
this.track_name.innerHTML=_64.track;
this.artist_name.innerHTML=_64.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_64.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_65){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_65.position/1000));
var _66;
if(_65.readyState==3){
_66=_65.duration;
}else{
_66=_65.durationEstimate;
}
var _67=_65.position/_66;
this.playhead.style.width=Math.round(_67*this.progress_bar_width)+"px";
this.loading_handler(_65);
},loading_handler:function(_68){
var _69=_68.bytesLoaded/_68.bytesTotal;
this.bufferhead.style.width=Math.round(_69*this.progress_bar_width)+"px";
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
var _6a="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _6b=[];
var rnd=Math.random;
var r;
_6b[8]=_6b[13]=_6b[18]=_6b[23]="-";
_6b[14]="4";
for(var i=0;i<36;i++){
if(!_6b[i]){
r=0|rnd()*16;
_6b[i]=_6a[(i==19)?(r&3)|8:r&15];
}
}
return _6b.join("");
},toQueryPair:function(key,_6c){
if(_6c===null){
return key;
}
return key+"="+encodeURIComponent(_6c);
},toQueryString:function(_6d){
var _6e=[];
for(var key in _6d){
var _6f=_6d[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_6f)=="[object Array]"){
for(var i=0;i<_6f.length;i++){
_6e.push(Playdar.Util.toQueryPair(key,_6f[i]));
}
}else{
_6e.push(Playdar.Util.toQueryPair(key,_6f));
}
}
return _6e.join("&");
},mmss:function(_70){
var s=_70%60;
if(s<10){
s="0"+s;
}
return Math.floor(_70/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_71,_72,_73){
if(_73){
var _74=new Date();
_74.setTime(_74.getTime()+(_73*24*60*60*1000));
var _75="; expires="+_74.toGMTString();
}else{
var _75="";
}
document.cookie=_71+"="+_72+_75+"; path=/";
},getcookie:function(_76){
var _77=_76+"=";
var _78=document.cookie.split(";");
for(var i=0;i<_78.length;i++){
var c=_78[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_77)==0){
return c.substring(_77.length,c.length);
}
}
return null;
},deletecookie:function(_79){
Playdar.Util.setcookie(_79,"",-1);
},get_window_position:function(){
var _7a={};
if(window.screenLeft){
_7a.x=window.screenLeft||0;
_7a.y=window.screenTop||0;
}else{
_7a.x=window.screenX||0;
_7a.y=window.screenY||0;
}
return _7a;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_7b){
var _7c=Playdar.Util.get_popup_location(_7b);
return ["left="+_7c.x,"top="+_7c.y,"width="+_7b.w,"height="+_7b.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_7d){
var _7e=Playdar.Util.get_window_position();
var _7f=Playdar.Util.get_window_size();
return {"x":Math.max(0,_7e.x+(_7f.w-_7d.w)/2),"y":Math.max(0,_7e.y+(_7f.h-_7d.h)/2)};
},addEvent:function(obj,_80,fn){
if(obj.attachEvent){
obj["e"+_80+fn]=fn;
obj[_80+fn]=function(){
obj["e"+_80+fn](window.event);
};
obj.attachEvent("on"+_80,obj[_80+fn]);
}else{
obj.addEventListener(_80,fn,false);
}
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_81,_82){
_82=_82||{};
for(var _83 in _82){
_81[_83]=_82[_83];
}
return _81;
},merge_callback_options:function(_84){
var _85={};
var _86=[];
var i,_87,_88;
for(i=0;i<_84.length;i++){
_87=_84[i];
for(_88 in _87){
if(typeof (_87[_88])=="function"){
if(!_85[_88]){
_86.push(_88);
_85[_88]=[];
}
_85[_88].push(_87);
}
}
}
var _89={};
var key,_8a;
for(i=0;i<_86.length;i++){
var key=_86[i];
_89[key]=(function(key,_8b){
return function(){
for(var j=0;j<_8b.length;j++){
_8b[j][key].apply(this,arguments);
}
};
})(key,_85[key]);
}
return _89;
},location_from_url:function(url){
var _8c=document.createElement("a");
_8c.href=url;
var _8d={};
for(k in window.location){
if((typeof (window.location[k])==="string")){
_8d[k]=_8c[k];
}
}
return _8d;
},log:function(_8e){
if(typeof console!="undefined"){
console.dir(_8e);
}
},null_callback:function(){
}};
Playdar.Parse={getProperty:function(_8f,_90){
var _90=_90||"innerHTML";
var i,_91,_92;
for(i=0;i<_8f.length;i++){
_91=_8f[i];
_92=_91[_90]||_91.getAttribute(_90);
if(_92){
return _92;
}
}
return;
},getValue:function(_93){
var i,_94,_95;
for(i=0;i<_93.length;i++){
_94=_93[i];
_95=Playdar.Util.select(".value",_94);
if(_95.length){
return Playdar.Parse.getContentWithoutValue(_95);
}
}
return;
},getContentWithoutValue:function(_96){
return Playdar.Parse.getProperty(_96,"content")||Playdar.Parse.getProperty(_96,"title")||Playdar.Parse.getProperty(_96);
},getContent:function(_97){
var _98=Playdar.Parse.getValue(_97)||Playdar.Parse.getContentWithoutValue(_97);
if(_98){
return _98.replace(/(^\s*)|(\s*$)/g,"");
}
return;
},getPosition:function(_99){
var _9a=_99;
var _9b=0;
if(_99.nodeName=="LI"&&_99.parentNode.nodeName=="OL"){
while(_9a.previousSibling){
_9a=_9a.previousSibling;
if(_9a.nodeName=="LI"){
_9b++;
}
}
return _9b+1;
}
return;
},getNS:function(_9c,url){
for(var i=0;i<_9c.attributes.length;i++){
var _9d=_9c.attributes[i];
if(_9d.nodeValue==url){
return _9d.nodeName.replace("xmlns:","");
}
}
},getExc:function(_9e,_9f){
return ":not("+_9e+" "+_9f+")";
},microformats:function(_a0){
var sel=Playdar.Util.select;
function _a1(_a2,_a3){
return sel(_a2+Playdar.Parse.getExc(".item",_a2),_a3);
};
function _a4(_a5,rec){
var _a6=rec?sel:_a1;
var _a7=Playdar.Parse.getProperty(_a6(".payment",_a5),"href")||Playdar.Parse.getProperty(_a6("[rel~=payment]",_a5),"href");
if(!_a7){
return;
}
return {url:_a7,currency:Playdar.Parse.getContent(_a6(".price .currency",_a5)),amount:Playdar.Parse.getContent(_a6(".price .amount",_a5))};
};
function _a8(_a9,_aa,_ab){
var _ac=[];
var i,_ad;
for(i=0;i<_a9.length;i++){
if(!_a9[i].playdarParsed){
_ad={title:Playdar.Parse.getContent(sel(".fn",_a9[i]))||Playdar.Parse.getContent(sel(".title",_a9[i])),artist:Playdar.Parse.getContent(sel(".contributor",_a9[i]))||_aa,album:_ab,position:Playdar.Parse.getContent(sel(".position",_a9[i]))||Playdar.Parse.getPosition(_a9[i]),duration:Playdar.Parse.getContent(sel(".duration",_a9[i])),buy:_a4(_a9[i],true),element:_a9[i]};
_ac.push(_ad);
_a9[i].playdarParsed=true;
}
}
return _ac;
};
function _ae(_af){
var _b0=_a1(".contributor",_af);
var _b1=Playdar.Parse.getContent(sel(".fn",_b0[0]));
if(!_b1){
_b1=Playdar.Parse.getContent(_b0);
}
return _b1;
};
function _b2(_b3){
var _b4=[];
var _b5=sel(".haudio",_b3);
var i,_b6,_b7,_b8,_b9,_ba,_bb,_bc,_b4;
for(i=0;i<_b5.length;i++){
if(!_b5[i].playdarParsed){
_b5[i].playdarParsed=true;
_b6=Playdar.Parse.getContent(_a1(".album",_b5[i]));
if(!_b6){
continue;
}
_b7=_ae(_b5[i]);
if(!_b7){
continue;
}
_b8=_a8(sel(".item",_b5[i]),_b7,_b6);
if(!_b8.length){
continue;
}
_b4.push({type:"album",title:_b6,artist:_b7,tracks:_b8,image:Playdar.Parse.getProperty(_a1(".photo",_b5[i]),"src")||Playdar.Parse.getProperty(_a1(".photo",_b5[i]),"href"),download:Playdar.Parse.getProperty(_a1("[rel~=enclosure]",_b5[i]),"href"),released:Playdar.Parse.getContent(_a1(".published",_b5[i])),duration:Playdar.Parse.getContent(_a1(".duration",_b5[i])),buy:_a4(_b5[i])});
}
}
return _b4;
};
function _bd(_be){
var _bf=_b2(_be);
var _c0=_a8(sel(".haudio"));
if(_c0.length){
_bf.push({type:"page",title:window.title||window.location.href,tracks:_c0});
}
return _bf;
};
var _c1=_bd(_a0);
return _c1;
},rdfa:function(_c2){
var sel=Playdar.Util.select;
var _c3=sel("html")[0];
var _c4=Playdar.Parse.getNS(_c3,"http://purl.org/commerce#");
var _c5=Playdar.Parse.getNS(_c3,"http://purl.org/media/audio#");
var _c6=Playdar.Parse.getNS(_c3,"http://purl.org/media#");
var _c7=Playdar.Parse.getNS(_c3,"http://purl.org/dc/terms/")||Playdar.Parse.getNS(_c3,"http://purl.org/dc/elements/1.1/");
var _c8=Playdar.Parse.getNS(_c3,"http://xmlns.com/foaf/0.1/");
var _c9=Playdar.Parse.getNS(_c3,"http://purl.org/ontology/mo/");
function _ca(_cb,_cc){
var _cd=_cb;
if(_c5){
_cd+=Playdar.Parse.getExc("[typeof="+_c5+":Recording]",_cb);
}
if(_c9){
_cd+=Playdar.Parse.getExc("[typeof="+_c9+":Track]",_cb);
}
return sel(_cd,_cc);
};
if(!_c5&&!_c9){
}
function _ce(_cf,rec){
var _d0=rec?sel:_ca;
var _d1=Playdar.Parse.getProperty(_d0("[rel~="+_c4+":payment]",_cf),"href");
if(!_d1){
return;
}
return {url:_d1,currency:Playdar.Parse.getContent(_d0("[rel~="+_c4+":costs] [property="+_c4+":currency]",_cf)),amount:Playdar.Parse.getContent(_d0("[rel~="+_c4+":costs] [property="+_c4+":amount]",_cf))};
};
function _d2(_d3,_d4,_d5){
var _d6=[];
var _d7=[];
if(_c5){
_d7.push("[typeof="+_c5+":Recording]");
}
if(_c9){
_d7.push("[typeof="+_c9+":Track]");
}
var _d8=_ca(_d7.join(","),_d3);
var i,_d9;
for(i=0;i<_d8.length;i++){
if(!_d8[i].playdarParsed){
_d9={title:Playdar.Parse.getContent(sel("[property="+_c7+":title]",_d8[i])),artist:Playdar.Parse.getContent(sel("[property="+_c7+":creator], [rel~="+_c8+":maker] [property="+_c8+":name]",_d8[i]))||_d4,album:Playdar.Parse.getContent(sel("[typeof="+_c9+":Record] [property="+_c7+":title]"))||_d5,position:Playdar.Parse.getContent(sel("[property="+_c6+":position]",_d8[i]))||Playdar.Parse.getPosition(_d8[i]),duration:Playdar.Parse.getContent(sel("[property="+_c6+":duration]",_d8[i]))||Playdar.Parse.getContent(sel("[property="+_c7+":duration]",_d8[i])),buy:_ce(_d8[i],true),element:_d8[i]};
_d6.push(_d9);
_d8[i].playdarParsed=true;
}
}
return _d6;
};
function _da(_db){
var _dc=_ca("[property="+_c7+":creator]",_db);
if(!_dc.length){
_dc=_ca("[rel~="+_c8+":maker]",_db);
}
var _dd;
if(_dc.length){
_dd=Playdar.Parse.getContent(sel("[property="+_c8+":name]",_dc[0]));
}
if(!_dd){
var _de=sel("[rel~="+_c7+":creator]",_db);
var _df=Playdar.Parse.getProperty(_de,"resource");
if(_df){
var _e0=sel("[about="+_df+"]");
_dd=Playdar.Parse.getContent(sel("[property="+_c8+":name]",_e0[0]))||Playdar.Parse.getContent(_e0);
}
}
if(!_dd){
_dd=Playdar.Parse.getContent(_dc);
}
return _dd;
};
function _e1(_e2){
var _e3=[];
var _e4=sel("[typeof="+_c5+":Album], [typeof="+_c9+":Record]",_e2);
var i,_e5,_e6,_e7,_e8;
for(i=0;i<_e4.length;i++){
if(!_e4[i].playdarParsed){
_e4[i].playdarParsed=true;
_e6=Playdar.Parse.getContent(_ca("[property="+_c7+":title]",_e4[i]));
if(!_e6){
continue;
}
_e7=_da(_e4[i]);
if(!_e7){
continue;
}
_e8=_d2(_e4[i],_e7,_e6);
if(!_e8.length){
continue;
}
_e3.push({type:"album",title:_e6,artist:_e7,tracks:_e8,image:Playdar.Parse.getProperty(_ca("[rel~="+_c6+":depiction]",_e4[i]),"src")||Playdar.Parse.getProperty(_ca("[rev~="+_c6+":depiction]",_e4[i]),"src"),download:Playdar.Parse.getProperty(_ca("[rel~="+_c6+":download]",_e4[i]),"href"),released:Playdar.Parse.getContent(_ca("[property="+_c7+":issued]",_e4[i]))||Playdar.Parse.getContent(_ca("[property="+_c7+":published]",_e4[i]))||Playdar.Parse.getContent(_ca("[property="+_c7+":date]",_e4[i])),duration:Playdar.Parse.getContent(_ca("[property="+_c6+":duration]",_e4[i]))||Playdar.Parse.getContent(_ca("[property="+_c7+":duration]",_e4[i])),buy:_ce(_e4[i])});
}
}
return _e3;
};
function _e9(_ea){
var _eb=_e1(_ea);
var _ec=_d2(_ea);
if(_ec.length){
_eb.push({type:"page",title:window.title||window.location.href,tracks:_ec});
}
return _eb;
};
var _ed=_e9(_c2);
return _ed;
}};
Playdar.Util.addEvent(window,"beforeunload",Playdar.unload);
(function(){
var _ee=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_ef=0,_f0=Object.prototype.toString,_f1=false;
var _f2=function(_f3,_f4,_f5,_f6){
_f5=_f5||[];
var _f7=_f4=_f4||document;
if(_f4.nodeType!==1&&_f4.nodeType!==9){
return [];
}
if(!_f3||typeof _f3!=="string"){
return _f5;
}
var _f8=[],m,set,_f9,_fa,_fb,_fc,_fd=true,_fe=_ff(_f4);
_ee.lastIndex=0;
while((m=_ee.exec(_f3))!==null){
_f8.push(m[1]);
if(m[2]){
_fc=RegExp.rightContext;
break;
}
}
if(_f8.length>1&&_100.exec(_f3)){
if(_f8.length===2&&Expr.relative[_f8[0]]){
set=_101(_f8[0]+_f8[1],_f4);
}else{
set=Expr.relative[_f8[0]]?[_f4]:_f2(_f8.shift(),_f4);
while(_f8.length){
_f3=_f8.shift();
if(Expr.relative[_f3]){
_f3+=_f8.shift();
}
set=_101(_f3,set);
}
}
}else{
if(!_f6&&_f8.length>1&&_f4.nodeType===9&&!_fe&&Expr.match.ID.test(_f8[0])&&!Expr.match.ID.test(_f8[_f8.length-1])){
var ret=_f2.find(_f8.shift(),_f4,_fe);
_f4=ret.expr?_f2.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_f4){
var ret=_f6?{expr:_f8.pop(),set:_102(_f6)}:_f2.find(_f8.pop(),_f8.length===1&&(_f8[0]==="~"||_f8[0]==="+")&&_f4.parentNode?_f4.parentNode:_f4,_fe);
set=ret.expr?_f2.filter(ret.expr,ret.set):ret.set;
if(_f8.length>0){
_f9=_102(set);
}else{
_fd=false;
}
while(_f8.length){
var cur=_f8.pop(),pop=cur;
if(!Expr.relative[cur]){
cur="";
}else{
pop=_f8.pop();
}
if(pop==null){
pop=_f4;
}
Expr.relative[cur](_f9,pop,_fe);
}
}else{
_f9=_f8=[];
}
}
if(!_f9){
_f9=set;
}
if(!_f9){
throw "Syntax error, unrecognized expression: "+(cur||_f3);
}
if(_f0.call(_f9)==="[object Array]"){
if(!_fd){
_f5.push.apply(_f5,_f9);
}else{
if(_f4&&_f4.nodeType===1){
for(var i=0;_f9[i]!=null;i++){
if(_f9[i]&&(_f9[i]===true||_f9[i].nodeType===1&&_103(_f4,_f9[i]))){
_f5.push(set[i]);
}
}
}else{
for(var i=0;_f9[i]!=null;i++){
if(_f9[i]&&_f9[i].nodeType===1){
_f5.push(set[i]);
}
}
}
}
}else{
_102(_f9,_f5);
}
if(_fc){
_f2(_fc,_f7,_f5,_f6);
_f2.uniqueSort(_f5);
}
return _f5;
};
_f2.uniqueSort=function(_104){
if(_105){
_f1=false;
_104.sort(_105);
if(_f1){
for(var i=1;i<_104.length;i++){
if(_104[i]===_104[i-1]){
_104.splice(i--,1);
}
}
}
}
};
_f2.matches=function(expr,set){
return _f2(expr,null,null,set);
};
_f2.find=function(expr,_106,_107){
var set,_108;
if(!expr){
return [];
}
for(var i=0,l=Expr.order.length;i<l;i++){
var type=Expr.order[i],_108;
if((_108=Expr.match[type].exec(expr))){
var left=RegExp.leftContext;
if(left.substr(left.length-1)!=="\\"){
_108[1]=(_108[1]||"").replace(/\\/g,"");
set=Expr.find[type](_108,_106,_107);
if(set!=null){
expr=expr.replace(Expr.match[type],"");
break;
}
}
}
}
if(!set){
set=_106.getElementsByTagName("*");
}
return {set:set,expr:expr};
};
_f2.filter=function(expr,set,_109,not){
var old=expr,_10a=[],_10b=set,_10c,_10d,_10e=set&&set[0]&&_ff(set[0]);
while(expr&&set.length){
for(var type in Expr.filter){
if((_10c=Expr.match[type].exec(expr))!=null){
var _10f=Expr.filter[type],_110,item;
_10d=false;
if(_10b==_10a){
_10a=[];
}
if(Expr.preFilter[type]){
_10c=Expr.preFilter[type](_10c,_10b,_109,_10a,not,_10e);
if(!_10c){
_10d=_110=true;
}else{
if(_10c===true){
continue;
}
}
}
if(_10c){
for(var i=0;(item=_10b[i])!=null;i++){
if(item){
_110=_10f(item,_10c,i,_10b);
var pass=not^!!_110;
if(_109&&_110!=null){
if(pass){
_10d=true;
}else{
_10b[i]=false;
}
}else{
if(pass){
_10a.push(item);
_10d=true;
}
}
}
}
}
if(_110!==undefined){
if(!_109){
_10b=_10a;
}
expr=expr.replace(Expr.match[type],"");
if(!_10d){
return [];
}
break;
}
}
}
if(expr==old){
if(_10d==null){
throw "Syntax error, unrecognized expression: "+expr;
}else{
break;
}
}
old=expr;
}
return _10b;
};
var Expr=_f2.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(elem){
return elem.getAttribute("href");
}},relative:{"+":function(_111,part,_112){
var _113=typeof part==="string",_114=_113&&!(/\W/).test(part),_115=_113&&!_114;
if(_114&&!_112){
part=part.toUpperCase();
}
for(var i=0,l=_111.length,elem;i<l;i++){
if((elem=_111[i])){
while((elem=elem.previousSibling)&&elem.nodeType!==1){
}
_111[i]=_115||elem&&elem.nodeName===part?elem||false:elem===part;
}
}
if(_115){
_f2.filter(part,_111,true);
}
},">":function(_116,part,_117){
var _118=typeof part==="string";
if(_118&&!(/\W/).test(part)){
part=_117?part:part.toUpperCase();
for(var i=0,l=_116.length;i<l;i++){
var elem=_116[i];
if(elem){
var _119=elem.parentNode;
_116[i]=_119.nodeName===part?_119:false;
}
}
}else{
for(var i=0,l=_116.length;i<l;i++){
var elem=_116[i];
if(elem){
_116[i]=_118?elem.parentNode:elem.parentNode===part;
}
}
if(_118){
_f2.filter(part,_116,true);
}
}
},"":function(_11a,part,_11b){
var _11c=_ef++,_11d=_11e;
if(!part.match(/\W/)){
var _11f=part=_11b?part:part.toUpperCase();
_11d=_120;
}
_11d("parentNode",part,_11c,_11a,_11f,_11b);
},"~":function(_121,part,_122){
var _123=_ef++,_124=_11e;
if(typeof part==="string"&&!part.match(/\W/)){
var _125=part=_122?part:part.toUpperCase();
_124=_120;
}
_124("previousSibling",part,_123,_121,_125,_122);
}},find:{ID:function(_126,_127,_128){
if(typeof _127.getElementById!=="undefined"&&!_128){
var m=_127.getElementById(_126[1]);
return m?[m]:[];
}
},NAME:function(_129,_12a,_12b){
if(typeof _12a.getElementsByName!=="undefined"){
var ret=[],_12c=_12a.getElementsByName(_129[1]);
for(var i=0,l=_12c.length;i<l;i++){
if(_12c[i].getAttribute("name")===_129[1]){
ret.push(_12c[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_12d,_12e){
return _12e.getElementsByTagName(_12d[1]);
}},preFilter:{CLASS:function(_12f,_130,_131,_132,not,_133){
_12f=" "+_12f[1].replace(/\\/g,"")+" ";
if(_133){
return _12f;
}
for(var i=0,elem;(elem=_130[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_12f)>=0)){
if(!_131){
_132.push(elem);
}
}else{
if(_131){
_130[i]=false;
}
}
}
}
return false;
},ID:function(_134){
return _134[1].replace(/\\/g,"");
},TAG:function(_135,_136){
for(var i=0;_136[i]===false;i++){
}
return _136[i]&&_ff(_136[i])?_135[1]:_135[1].toUpperCase();
},CHILD:function(_137){
if(_137[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_137[2]=="even"&&"2n"||_137[2]=="odd"&&"2n+1"||!(/\D/).test(_137[2])&&"0n+"+_137[2]||_137[2]);
_137[2]=(test[1]+(test[2]||1))-0;
_137[3]=test[3]-0;
}
_137[0]=_ef++;
return _137;
},ATTR:function(_138,_139,_13a,_13b,not,_13c){
var name=_138[1].replace(/\\/g,"");
if(!_13c&&Expr.attrMap[name]){
_138[1]=Expr.attrMap[name];
}
if(_138[2]==="~="){
_138[4]=" "+_138[4]+" ";
}
return _138;
},PSEUDO:function(_13d,_13e,_13f,_140,not){
if(_13d[1]==="not"){
if(_13d[3].match(_ee).length>1||(/^\w/).test(_13d[3])){
_13d[3]=_f2(_13d[3],null,null,_13e);
}else{
var ret=_f2.filter(_13d[3],_13e,_13f,true^not);
if(!_13f){
_140.push.apply(_140,ret);
}
return false;
}
}else{
if(Expr.match.POS.test(_13d[0])||Expr.match.CHILD.test(_13d[0])){
return true;
}
}
return _13d;
},POS:function(_141){
_141.unshift(true);
return _141;
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
},has:function(elem,i,_142){
return !!_f2(_142[3],elem).length;
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
},last:function(elem,i,_143,_144){
return i===_144.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_145){
return i<_145[3]-0;
},gt:function(elem,i,_146){
return i>_146[3]-0;
},nth:function(elem,i,_147){
return _147[3]-0==i;
},eq:function(elem,i,_148){
return _148[3]-0==i;
}},filter:{PSEUDO:function(elem,_149,i,_14a){
var name=_149[1],_14b=Expr.filters[name];
if(_14b){
return _14b(elem,i,_149,_14a);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_149[3])>=0;
}else{
if(name==="not"){
var not=_149[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_14c){
var type=_14c[1],node=elem;
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
var _14d=_14c[2],last=_14c[3];
if(_14d==1&&last==0){
return true;
}
var _14e=_14c[0],_14f=elem.parentNode;
if(_14f&&(_14f.sizcache!==_14e||!elem.nodeIndex)){
var _150=0;
for(node=_14f.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_150;
}
}
_14f.sizcache=_14e;
}
var diff=elem.nodeIndex-last;
if(_14d==0){
return diff==0;
}else{
return (diff%_14d==0&&diff/_14d>=0);
}
}
},ID:function(elem,_151){
return elem.nodeType===1&&elem.getAttribute("id")===_151;
},TAG:function(elem,_152){
return (_152==="*"&&elem.nodeType===1)||elem.nodeName===_152;
},CLASS:function(elem,_153){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_153)>-1;
},ATTR:function(elem,_154){
var name=_154[1],_155=Expr.attrHandle[name]?Expr.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_156=_155+"",type=_154[2],_157=_154[4];
return _155==null?type==="!=":type==="="?_156===_157:type==="*="?_156.indexOf(_157)>=0:type==="~="?(" "+_156+" ").indexOf(_157)>=0:!_157?_156&&_155!==false:type==="!="?_156!=_157:type==="^="?_156.indexOf(_157)===0:type==="$="?_156.substr(_156.length-_157.length)===_157:type==="|="?_156===_157||_156.substr(0,_157.length+1)===_157+"-":false;
},POS:function(elem,_158,i,_159){
var name=_158[2],_15a=Expr.setFilters[name];
if(_15a){
return _15a(elem,i,_158,_159);
}
}}};
var _100=Expr.match.POS;
for(var type in Expr.match){
Expr.match[type]=new RegExp(Expr.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _102=function(_15b,_15c){
_15b=Array.prototype.slice.call(_15b);
if(_15c){
_15c.push.apply(_15c,_15b);
return _15c;
}
return _15b;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_102=function(_15d,_15e){
var ret=_15e||[];
if(_f0.call(_15d)==="[object Array]"){
Array.prototype.push.apply(ret,_15d);
}else{
if(typeof _15d.length==="number"){
for(var i=0,l=_15d.length;i<l;i++){
ret.push(_15d[i]);
}
}else{
for(var i=0;_15d[i];i++){
ret.push(_15d[i]);
}
}
}
return ret;
};
}
var _105;
if(document.documentElement.compareDocumentPosition){
_105=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_f1=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_105=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_f1=true;
}
return ret;
};
}else{
if(document.createRange){
_105=function(a,b){
var _15f=a.ownerDocument.createRange(),_160=b.ownerDocument.createRange();
_15f.selectNode(a);
_15f.collapse(true);
_160.selectNode(b);
_160.collapse(true);
var ret=_15f.compareBoundaryPoints(Range.START_TO_END,_160);
if(ret===0){
_f1=true;
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
Expr.find.ID=function(_161,_162,_163){
if(typeof _162.getElementById!=="undefined"&&!_163){
var m=_162.getElementById(_161[1]);
return m?m.id===_161[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_161[1]?[m]:undefined:[];
}
};
Expr.filter.ID=function(elem,_164){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_164;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
Expr.find.TAG=function(_165,_166){
var _167=_166.getElementsByTagName(_165[1]);
if(_165[1]==="*"){
var tmp=[];
for(var i=0;_167[i];i++){
if(_167[i].nodeType===1){
tmp.push(_167[i]);
}
}
_167=tmp;
}
return _167;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
Expr.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _168=_f2,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_f2=function(_169,_16a,_16b,seed){
_16a=_16a||document;
if(!seed&&_16a.nodeType===9&&!_ff(_16a)){
try{
return _102(_16a.querySelectorAll(_169),_16b);
}
catch(e){
}
}
return _168(_169,_16a,_16b,seed);
};
for(var prop in _168){
_f2[prop]=_168[prop];
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
Expr.order.splice(1,0,"CLASS");
Expr.find.CLASS=function(_16c,_16d,_16e){
if(typeof _16d.getElementsByClassName!=="undefined"&&!_16e){
return _16d.getElementsByClassName(_16c[1]);
}
};
})();
}
function _120(dir,cur,_16f,_170,_171,_172){
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
if(elem.nodeType===1&&!_172){
elem.sizcache=_16f;
elem.sizset=i;
}
if(elem.nodeName===cur){
_174=elem;
break;
}
elem=elem[dir];
}
_170[i]=_174;
}
}
};
function _11e(dir,cur,_175,_176,_177,_178){
var _179=dir=="previousSibling"&&!_178;
for(var i=0,l=_176.length;i<l;i++){
var elem=_176[i];
if(elem){
if(_179&&elem.nodeType===1){
elem.sizcache=_175;
elem.sizset=i;
}
elem=elem[dir];
var _17a=false;
while(elem){
if(elem.sizcache===_175){
_17a=_176[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_178){
elem.sizcache=_175;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_17a=true;
break;
}
}else{
if(_f2.filter(cur,[elem]).length>0){
_17a=elem;
break;
}
}
}
elem=elem[dir];
}
_176[i]=_17a;
}
}
};
var _103=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _ff=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _101=function(_17b,_17c){
var _17d=[],_17e="",_17f,root=_17c.nodeType?[_17c]:_17c;
while((_17f=Expr.match.PSEUDO.exec(_17b))){
_17e+=_17f[0];
_17b=_17b.replace(Expr.match.PSEUDO,"");
}
_17b=Expr.relative[_17b]?_17b+"*":_17b;
for(var i=0,l=root.length;i<l;i++){
_f2(_17b,root[i],_17d);
}
return _f2.filter(_17e,_17d);
};
Playdar.Util.select=_f2;
})();

