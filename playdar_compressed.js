Playdar={VERSION:"0.4.6",SERVER_ROOT:"localhost",SERVER_PORT:"60210",STATIC_HOST:"http://www.playdar.org",STAT_TIMEOUT:2000,AUTH_COOKIE_NAME:"Playdar.Auth",AUTH_POPUP_NAME:"Playdar.AuthPopup",AUTH_POPUP_SIZE:{"w":500,"h":260},QUERIES_POPUP_NAME:"Playdar.QueriesPopup",QUERIES_POPUP_SIZE:{"w":640,"h":700},MAX_POLLS:4,MAX_CONCURRENT_RESOLUTIONS:5,USE_STATUS_BAR:true,USE_SCROBBLER:true,client:null,status_bar:null,player:null,setup:function(_1){
var _1=_1||{};
_1.name=_1.name||window.document.title;
_1.website=_1.website||window.location.href;
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
for(var _47 in Playdar.Player.MIMETYPES){
_46.push(_47);
}
return _46;
},register_stream:function(_48,_49){
if(this.streams[_48.sid]){
return false;
}
this.streams[_48.sid]=_48;
var _4a=Playdar.Util.extend_object({id:"s_"+_48.sid,url:Playdar.client.get_stream_url(_48.sid),isMovieStar:Playdar.Player.MIMETYPES[_48.mimetype]===true,bufferTime:2},_49);
var _4b=[_49];
if(Playdar.status_bar){
_4b.push(Playdar.status_bar.get_sound_callbacks(_48));
}
if(Playdar.scrobbler){
_4b.push(Playdar.scrobbler.get_sound_callbacks(_48));
}
Playdar.Util.extend_object(_4a,Playdar.Util.merge_callback_options(_4b));
try{
var _4c=this.soundmanager.createSound(_4a);
}
catch(e){
return false;
}
return _4c;
},play_stream:function(sid){
var _4d=this.soundmanager.getSoundById("s_"+sid);
if(this.nowplayingid!=sid){
this.stop_current();
if(_4d.playState==0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_4d.togglePause();
return _4d;
},stop_current:function(_4e){
if(_4e){
if(Playdar.scrobbler){
Playdar.scrobbler.stop();
}
}
if(this.nowplayingid){
var _4f=this.soundmanager.getSoundById("s_"+this.nowplayingid);
if(_4f.playState==1){
_4f.setPosition(1);
_4f.stop();
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
var _50=document.createElement("div");
_50.style.position="fixed";
_50.style.bottom=0;
_50.style.left=0;
_50.style.zIndex=100;
_50.style.width="100%";
_50.style.height="36px";
_50.style.padding="7px 0";
_50.style.borderTop="2px solid #4c7a0f";
_50.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_50.style.color="#335507";
_50.style.background="#e8f9bb";
var _51=document.createElement("div");
_51.style.padding="0 7px";
var _52="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_51.innerHTML=_52;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_51.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _53=document.createElement("p");
_53.style.margin="0";
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
_53.appendChild(this.track_link);
this.playback.appendChild(_53);
var _54=document.createElement("table");
_54.setAttribute("cellpadding",0);
_54.setAttribute("cellspacing",0);
_54.setAttribute("border",0);
_54.style.color="#4c7a0f";
_54.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _55=document.createElement("tbody");
var _56=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_56.appendChild(this.track_elapsed);
var _57=document.createElement("td");
_57.style.padding="0 5px";
_57.style.verticalAlign="middle";
var _58=document.createElement("div");
_58.style.width=this.progress_bar_width+"px";
_58.style.height="9px";
_58.style.border="1px solid #4c7a0f";
_58.style.background="#fff";
_58.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_58.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_58.appendChild(this.playhead);
_58.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_57.appendChild(_58);
_56.appendChild(_57);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_56.appendChild(this.track_duration);
_55.appendChild(_56);
_54.appendChild(_55);
this.playback.appendChild(_54);
_51.appendChild(this.playback);
var _59=document.createElement("div");
_59.style.cssFloat="right";
_59.style.padding="0 8px";
_59.style.textAlign="right";
var _5a=document.createElement("p");
_5a.style.margin=0;
_5a.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_59.appendChild(_5a);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML=Playdar.client.get_disconnect_link_html();
_59.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_50.appendChild(_59);
_50.appendChild(_51);
document.body.appendChild(_50);
var _5b=document.body.style.marginBottom;
if(!_5b){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_5b=css.marginBottom;
}
}
document.body.style.marginBottom=(_5b.replace("px","")-0)+36+(7*2)+2+"px";
return _50;
},ready:function(){
this.playdar_links.style.display="";
var _5c="Ready";
this.status.innerHTML=_5c;
},offline:function(){
this.playdar_links.style.display="none";
var _5d=Playdar.client.get_auth_link_html();
this.status.innerHTML=_5d;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _5e="manualAuth_"+Playdar.client.uuid;
var _5f="<form>"+"<input type=\"text\" id=\""+_5e+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_5e+"'); return false;"+"\" />"+"</form>";
this.status.innerHTML=_5f;
},handle_stat:function(_60){
if(_60.authenticated){
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
var _61=" ";
if(this.pending_count){
_61+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_61+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_61;
}
},handle_results:function(_62,_63){
if(_63){
this.pending_count--;
if(_62.results.length){
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
},get_sound_callbacks:function(_64){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
}};
},play_handler:function(_65){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_65.sid);
this.track_link.title=_65.source;
this.track_name.innerHTML=_65.track;
this.artist_name.innerHTML=_65.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_65.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_66){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_66.position/1000));
var _67;
if(_66.readyState==3){
_67=_66.duration;
}else{
_67=_66.durationEstimate;
}
var _68=_66.position/_67;
this.playhead.style.width=Math.round(_68*this.progress_bar_width)+"px";
this.loading_handler(_66);
},loading_handler:function(_69){
var _6a=_69.bytesLoaded/_69.bytesTotal;
this.bufferhead.style.width=Math.round(_6a*this.progress_bar_width)+"px";
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
var _6b="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _6c=[];
var rnd=Math.random;
var r;
_6c[8]=_6c[13]=_6c[18]=_6c[23]="-";
_6c[14]="4";
for(var i=0;i<36;i++){
if(!_6c[i]){
r=0|rnd()*16;
_6c[i]=_6b[(i==19)?(r&3)|8:r&15];
}
}
return _6c.join("");
},toQueryPair:function(key,_6d){
if(_6d===null){
return key;
}
return key+"="+encodeURIComponent(_6d);
},toQueryString:function(_6e){
var _6f=[];
for(var key in _6e){
var _70=_6e[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_70)=="[object Array]"){
for(var i=0;i<_70.length;i++){
_6f.push(Playdar.Util.toQueryPair(key,_70[i]));
}
}else{
_6f.push(Playdar.Util.toQueryPair(key,_70));
}
}
return _6f.join("&");
},mmss:function(_71){
var s=_71%60;
if(s<10){
s="0"+s;
}
return Math.floor(_71/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_72,_73,_74){
if(_74){
var _75=new Date();
_75.setTime(_75.getTime()+(_74*24*60*60*1000));
var _76="; expires="+_75.toGMTString();
}else{
var _76="";
}
document.cookie=_72+"="+_73+_76+"; path=/";
},getcookie:function(_77){
var _78=_77+"=";
var _79=document.cookie.split(";");
for(var i=0;i<_79.length;i++){
var c=_79[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_78)==0){
return c.substring(_78.length,c.length);
}
}
return null;
},deletecookie:function(_7a){
Playdar.Util.setcookie(_7a,"",-1);
},get_window_position:function(){
var _7b={};
if(window.screenLeft){
_7b.x=window.screenLeft||0;
_7b.y=window.screenTop||0;
}else{
_7b.x=window.screenX||0;
_7b.y=window.screenY||0;
}
return _7b;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_7c){
var _7d=Playdar.Util.get_popup_location(_7c);
return ["left="+_7d.x,"top="+_7d.y,"width="+_7c.w,"height="+_7c.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_7e){
var _7f=Playdar.Util.get_window_position();
var _80=Playdar.Util.get_window_size();
return {"x":Math.max(0,_7f.x+(_80.w-_7e.w)/2),"y":Math.max(0,_7f.y+(_80.h-_7e.h)/2)};
},addEvent:function(obj,_81,fn){
if(obj.attachEvent){
obj["e"+_81+fn]=fn;
obj[_81+fn]=function(){
obj["e"+_81+fn](window.event);
};
obj.attachEvent("on"+_81,obj[_81+fn]);
}else{
obj.addEventListener(_81,fn,false);
}
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_82,_83){
_83=_83||{};
for(var _84 in _83){
_82[_84]=_83[_84];
}
return _82;
},merge_callback_options:function(_85){
var _86={};
var _87=[];
var i,_88,_89;
for(i=0;i<_85.length;i++){
_88=_85[i];
for(_89 in _88){
if(typeof (_88[_89])=="function"){
if(!_86[_89]){
_87.push(_89);
_86[_89]=[];
}
_86[_89].push(_88);
}
}
}
var _8a={};
var key,_8b;
for(i=0;i<_87.length;i++){
var key=_87[i];
_8a[key]=(function(key,_8c){
return function(){
for(var j=0;j<_8c.length;j++){
_8c[j][key].apply(this,arguments);
}
};
})(key,_86[key]);
}
return _8a;
},location_from_url:function(url){
var _8d=document.createElement("a");
_8d.href=url;
var _8e={};
for(k in window.location){
if((typeof (window.location[k])==="string")){
_8e[k]=_8d[k];
}
}
return _8e;
},log:function(_8f){
if(typeof console!="undefined"){
console.dir(_8f);
}
},null_callback:function(){
}};
Playdar.Parse={getProperty:function(_90,_91){
var _91=_91||"innerHTML";
var i,_92,_93;
for(i=0;i<_90.length;i++){
_92=_90[i];
_93=_92[_91]||_92.getAttribute(_91);
if(_93){
return _93;
}
}
return;
},getValue:function(_94){
var i,_95,_96;
for(i=0;i<_94.length;i++){
_95=_94[i];
_96=Playdar.Util.select(".value",_95);
if(_96.length){
return Playdar.Parse.getContentWithoutValue(_96);
}
}
return;
},getContentWithoutValue:function(_97){
return Playdar.Parse.getProperty(_97,"content")||Playdar.Parse.getProperty(_97,"title")||Playdar.Parse.getProperty(_97);
},getContent:function(_98){
var _99=Playdar.Parse.getValue(_98)||Playdar.Parse.getContentWithoutValue(_98);
if(_99){
return _99.replace(/(^\s*)|(\s*$)/g,"");
}
return;
},getPosition:function(_9a){
var _9b=_9a;
var _9c=0;
if(_9a.nodeName=="LI"&&_9a.parentNode.nodeName=="OL"){
while(_9b.previousSibling){
_9b=_9b.previousSibling;
if(_9b.nodeName=="LI"){
_9c++;
}
}
return _9c+1;
}
return;
},getNS:function(_9d,url){
for(var i=0;i<_9d.attributes.length;i++){
var _9e=_9d.attributes[i];
if(_9e.nodeValue==url){
return _9e.nodeName.replace("xmlns:","");
}
}
},getExc:function(_9f,_a0){
return ":not("+_9f+" "+_a0+")";
},microformats:function(_a1){
var sel=Playdar.Util.select;
function _a2(_a3,_a4){
return sel(_a3+Playdar.Parse.getExc(".item",_a3),_a4);
};
function _a5(_a6,rec){
var _a7=rec?sel:_a2;
var _a8=Playdar.Parse.getProperty(_a7(".payment",_a6),"href")||Playdar.Parse.getProperty(_a7("[rel~=payment]",_a6),"href");
if(!_a8){
return;
}
return {url:_a8,currency:Playdar.Parse.getContent(_a7(".price .currency",_a6)),amount:Playdar.Parse.getContent(_a7(".price .amount",_a6))};
};
function _a9(_aa,_ab,_ac){
var _ad=[];
var i,_ae;
for(i=0;i<_aa.length;i++){
if(!_aa[i].playdarParsed){
_ae={title:Playdar.Parse.getContent(sel(".fn",_aa[i]))||Playdar.Parse.getContent(sel(".title",_aa[i])),artist:Playdar.Parse.getContent(sel(".contributor",_aa[i]))||_ab,album:_ac,position:Playdar.Parse.getContent(sel(".position",_aa[i]))||Playdar.Parse.getPosition(_aa[i]),duration:Playdar.Parse.getContent(sel(".duration",_aa[i])),buy:_a5(_aa[i],true),element:_aa[i]};
_ad.push(_ae);
_aa[i].playdarParsed=true;
}
}
return _ad;
};
function _af(_b0){
var _b1=_a2(".contributor",_b0);
var _b2=Playdar.Parse.getContent(sel(".fn",_b1[0]));
if(!_b2){
_b2=Playdar.Parse.getContent(_b1);
}
return _b2;
};
function _b3(_b4){
var _b5=[];
var _b6=sel(".haudio",_b4);
var i,_b7,_b8,_b9,_ba,_bb,_bc,_bd,_b5;
for(i=0;i<_b6.length;i++){
if(!_b6[i].playdarParsed){
_b6[i].playdarParsed=true;
_b7=Playdar.Parse.getContent(_a2(".album",_b6[i]));
if(!_b7){
continue;
}
_b8=_af(_b6[i]);
if(!_b8){
continue;
}
_b9=_a9(sel(".item",_b6[i]),_b8,_b7);
if(!_b9.length){
continue;
}
_b5.push({type:"album",title:_b7,artist:_b8,tracks:_b9,image:Playdar.Parse.getProperty(_a2(".photo",_b6[i]),"src")||Playdar.Parse.getProperty(_a2(".photo",_b6[i]),"href"),download:Playdar.Parse.getProperty(_a2("[rel~=enclosure]",_b6[i]),"href"),released:Playdar.Parse.getContent(_a2(".published",_b6[i])),duration:Playdar.Parse.getContent(_a2(".duration",_b6[i])),buy:_a5(_b6[i])});
}
}
return _b5;
};
function _be(_bf){
var _c0=_b3(_bf);
var _c1=_a9(sel(".haudio"));
if(_c1.length){
_c0.push({type:"page",title:window.document.title||window.location.href,tracks:_c1});
}
return _c0;
};
var _c2=_be(_a1);
return _c2;
},rdfa:function(_c3){
var sel=Playdar.Util.select;
var _c4=sel("html")[0];
var _c5=Playdar.Parse.getNS(_c4,"http://purl.org/commerce#");
var _c6=Playdar.Parse.getNS(_c4,"http://purl.org/media/audio#");
var _c7=Playdar.Parse.getNS(_c4,"http://purl.org/media#");
var _c8=Playdar.Parse.getNS(_c4,"http://purl.org/dc/terms/")||Playdar.Parse.getNS(_c4,"http://purl.org/dc/elements/1.1/");
var _c9=Playdar.Parse.getNS(_c4,"http://xmlns.com/foaf/0.1/");
var _ca=Playdar.Parse.getNS(_c4,"http://purl.org/ontology/mo/");
function _cb(_cc,_cd){
var _ce=_cc;
if(_c6){
_ce+=Playdar.Parse.getExc("[typeof="+_c6+":Recording]",_cc);
}
if(_ca){
_ce+=Playdar.Parse.getExc("[typeof="+_ca+":Track]",_cc);
}
return sel(_ce,_cd);
};
if(!_c6&&!_ca){
}
function _cf(_d0,rec){
var _d1=rec?sel:_cb;
var _d2=Playdar.Parse.getProperty(_d1("[rel~="+_c5+":payment]",_d0),"href");
if(!_d2){
return;
}
return {url:_d2,currency:Playdar.Parse.getContent(_d1("[rel~="+_c5+":costs] [property="+_c5+":currency]",_d0)),amount:Playdar.Parse.getContent(_d1("[rel~="+_c5+":costs] [property="+_c5+":amount]",_d0))};
};
function _d3(_d4,_d5,_d6){
var _d7=[];
var _d8=[];
if(_c6){
_d8.push("[typeof="+_c6+":Recording]");
}
if(_ca){
_d8.push("[typeof="+_ca+":Track]");
}
var _d9=_cb(_d8.join(","),_d4);
var i,_da;
for(i=0;i<_d9.length;i++){
if(!_d9[i].playdarParsed){
_da={title:Playdar.Parse.getContent(sel("[property="+_c8+":title]",_d9[i])),artist:Playdar.Parse.getContent(sel("[property="+_c8+":creator], [rel~="+_c9+":maker] [property="+_c9+":name]",_d9[i]))||_d5,album:Playdar.Parse.getContent(sel("[typeof="+_ca+":Record] [property="+_c8+":title]"))||_d6,position:Playdar.Parse.getContent(sel("[property="+_c7+":position]",_d9[i]))||Playdar.Parse.getPosition(_d9[i]),duration:Playdar.Parse.getContent(sel("[property="+_c7+":duration]",_d9[i]))||Playdar.Parse.getContent(sel("[property="+_c8+":duration]",_d9[i])),buy:_cf(_d9[i],true),element:_d9[i]};
_d7.push(_da);
_d9[i].playdarParsed=true;
}
}
return _d7;
};
function _db(_dc){
var _dd=_cb("[property="+_c8+":creator]",_dc);
if(!_dd.length){
_dd=_cb("[rel~="+_c9+":maker]",_dc);
}
var _de;
if(_dd.length){
_de=Playdar.Parse.getContent(sel("[property="+_c9+":name]",_dd[0]));
}
if(!_de){
var _df=sel("[rel~="+_c8+":creator]",_dc);
var _e0=Playdar.Parse.getProperty(_df,"resource");
if(_e0){
var _e1=sel("[about="+_e0+"]");
_de=Playdar.Parse.getContent(sel("[property="+_c9+":name]",_e1[0]))||Playdar.Parse.getContent(_e1);
}
}
if(!_de){
_de=Playdar.Parse.getContent(_dd);
}
return _de;
};
function _e2(_e3){
var _e4=[];
var _e5=sel("[typeof="+_c6+":Album], [typeof="+_ca+":Record]",_e3);
var i,_e6,_e7,_e8,_e9;
for(i=0;i<_e5.length;i++){
if(!_e5[i].playdarParsed){
_e5[i].playdarParsed=true;
_e7=Playdar.Parse.getContent(_cb("[property="+_c8+":title]",_e5[i]));
if(!_e7){
continue;
}
_e8=_db(_e5[i]);
if(!_e8){
continue;
}
_e9=_d3(_e5[i],_e8,_e7);
if(!_e9.length){
continue;
}
_e4.push({type:"album",title:_e7,artist:_e8,tracks:_e9,image:Playdar.Parse.getProperty(_cb("[rel~="+_c7+":depiction]",_e5[i]),"src")||Playdar.Parse.getProperty(_cb("[rev~="+_c7+":depiction]",_e5[i]),"src"),download:Playdar.Parse.getProperty(_cb("[rel~="+_c7+":download]",_e5[i]),"href"),released:Playdar.Parse.getContent(_cb("[property="+_c8+":issued]",_e5[i]))||Playdar.Parse.getContent(_cb("[property="+_c8+":published]",_e5[i]))||Playdar.Parse.getContent(_cb("[property="+_c8+":date]",_e5[i])),duration:Playdar.Parse.getContent(_cb("[property="+_c7+":duration]",_e5[i]))||Playdar.Parse.getContent(_cb("[property="+_c8+":duration]",_e5[i])),buy:_cf(_e5[i])});
}
}
return _e4;
};
function _ea(_eb){
var _ec=_e2(_eb);
var _ed=_d3(_eb);
if(_ed.length){
_ec.push({type:"page",title:window.document.title||window.location.href,tracks:_ed});
}
return _ec;
};
var _ee=_ea(_c3);
return _ee;
}};
Playdar.Util.addEvent(window,"beforeunload",Playdar.unload);
(function(){
var _ef=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_f0=0,_f1=Object.prototype.toString,_f2=false;
var _f3=function(_f4,_f5,_f6,_f7){
_f6=_f6||[];
var _f8=_f5=_f5||document;
if(_f5.nodeType!==1&&_f5.nodeType!==9){
return [];
}
if(!_f4||typeof _f4!=="string"){
return _f6;
}
var _f9=[],m,set,_fa,_fb,_fc,_fd,_fe=true,_ff=_100(_f5);
_ef.lastIndex=0;
while((m=_ef.exec(_f4))!==null){
_f9.push(m[1]);
if(m[2]){
_fd=RegExp.rightContext;
break;
}
}
if(_f9.length>1&&_101.exec(_f4)){
if(_f9.length===2&&Expr.relative[_f9[0]]){
set=_102(_f9[0]+_f9[1],_f5);
}else{
set=Expr.relative[_f9[0]]?[_f5]:_f3(_f9.shift(),_f5);
while(_f9.length){
_f4=_f9.shift();
if(Expr.relative[_f4]){
_f4+=_f9.shift();
}
set=_102(_f4,set);
}
}
}else{
if(!_f7&&_f9.length>1&&_f5.nodeType===9&&!_ff&&Expr.match.ID.test(_f9[0])&&!Expr.match.ID.test(_f9[_f9.length-1])){
var ret=_f3.find(_f9.shift(),_f5,_ff);
_f5=ret.expr?_f3.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_f5){
var ret=_f7?{expr:_f9.pop(),set:_103(_f7)}:_f3.find(_f9.pop(),_f9.length===1&&(_f9[0]==="~"||_f9[0]==="+")&&_f5.parentNode?_f5.parentNode:_f5,_ff);
set=ret.expr?_f3.filter(ret.expr,ret.set):ret.set;
if(_f9.length>0){
_fa=_103(set);
}else{
_fe=false;
}
while(_f9.length){
var cur=_f9.pop(),pop=cur;
if(!Expr.relative[cur]){
cur="";
}else{
pop=_f9.pop();
}
if(pop==null){
pop=_f5;
}
Expr.relative[cur](_fa,pop,_ff);
}
}else{
_fa=_f9=[];
}
}
if(!_fa){
_fa=set;
}
if(!_fa){
throw "Syntax error, unrecognized expression: "+(cur||_f4);
}
if(_f1.call(_fa)==="[object Array]"){
if(!_fe){
_f6.push.apply(_f6,_fa);
}else{
if(_f5&&_f5.nodeType===1){
for(var i=0;_fa[i]!=null;i++){
if(_fa[i]&&(_fa[i]===true||_fa[i].nodeType===1&&_104(_f5,_fa[i]))){
_f6.push(set[i]);
}
}
}else{
for(var i=0;_fa[i]!=null;i++){
if(_fa[i]&&_fa[i].nodeType===1){
_f6.push(set[i]);
}
}
}
}
}else{
_103(_fa,_f6);
}
if(_fd){
_f3(_fd,_f8,_f6,_f7);
_f3.uniqueSort(_f6);
}
return _f6;
};
_f3.uniqueSort=function(_105){
if(_106){
_f2=false;
_105.sort(_106);
if(_f2){
for(var i=1;i<_105.length;i++){
if(_105[i]===_105[i-1]){
_105.splice(i--,1);
}
}
}
}
};
_f3.matches=function(expr,set){
return _f3(expr,null,null,set);
};
_f3.find=function(expr,_107,_108){
var set,_109;
if(!expr){
return [];
}
for(var i=0,l=Expr.order.length;i<l;i++){
var type=Expr.order[i],_109;
if((_109=Expr.match[type].exec(expr))){
var left=RegExp.leftContext;
if(left.substr(left.length-1)!=="\\"){
_109[1]=(_109[1]||"").replace(/\\/g,"");
set=Expr.find[type](_109,_107,_108);
if(set!=null){
expr=expr.replace(Expr.match[type],"");
break;
}
}
}
}
if(!set){
set=_107.getElementsByTagName("*");
}
return {set:set,expr:expr};
};
_f3.filter=function(expr,set,_10a,not){
var old=expr,_10b=[],_10c=set,_10d,_10e,_10f=set&&set[0]&&_100(set[0]);
while(expr&&set.length){
for(var type in Expr.filter){
if((_10d=Expr.match[type].exec(expr))!=null){
var _110=Expr.filter[type],_111,item;
_10e=false;
if(_10c==_10b){
_10b=[];
}
if(Expr.preFilter[type]){
_10d=Expr.preFilter[type](_10d,_10c,_10a,_10b,not,_10f);
if(!_10d){
_10e=_111=true;
}else{
if(_10d===true){
continue;
}
}
}
if(_10d){
for(var i=0;(item=_10c[i])!=null;i++){
if(item){
_111=_110(item,_10d,i,_10c);
var pass=not^!!_111;
if(_10a&&_111!=null){
if(pass){
_10e=true;
}else{
_10c[i]=false;
}
}else{
if(pass){
_10b.push(item);
_10e=true;
}
}
}
}
}
if(_111!==undefined){
if(!_10a){
_10c=_10b;
}
expr=expr.replace(Expr.match[type],"");
if(!_10e){
return [];
}
break;
}
}
}
if(expr==old){
if(_10e==null){
throw "Syntax error, unrecognized expression: "+expr;
}else{
break;
}
}
old=expr;
}
return _10c;
};
var Expr=_f3.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(elem){
return elem.getAttribute("href");
}},relative:{"+":function(_112,part,_113){
var _114=typeof part==="string",_115=_114&&!(/\W/).test(part),_116=_114&&!_115;
if(_115&&!_113){
part=part.toUpperCase();
}
for(var i=0,l=_112.length,elem;i<l;i++){
if((elem=_112[i])){
while((elem=elem.previousSibling)&&elem.nodeType!==1){
}
_112[i]=_116||elem&&elem.nodeName===part?elem||false:elem===part;
}
}
if(_116){
_f3.filter(part,_112,true);
}
},">":function(_117,part,_118){
var _119=typeof part==="string";
if(_119&&!(/\W/).test(part)){
part=_118?part:part.toUpperCase();
for(var i=0,l=_117.length;i<l;i++){
var elem=_117[i];
if(elem){
var _11a=elem.parentNode;
_117[i]=_11a.nodeName===part?_11a:false;
}
}
}else{
for(var i=0,l=_117.length;i<l;i++){
var elem=_117[i];
if(elem){
_117[i]=_119?elem.parentNode:elem.parentNode===part;
}
}
if(_119){
_f3.filter(part,_117,true);
}
}
},"":function(_11b,part,_11c){
var _11d=_f0++,_11e=_11f;
if(!part.match(/\W/)){
var _120=part=_11c?part:part.toUpperCase();
_11e=_121;
}
_11e("parentNode",part,_11d,_11b,_120,_11c);
},"~":function(_122,part,_123){
var _124=_f0++,_125=_11f;
if(typeof part==="string"&&!part.match(/\W/)){
var _126=part=_123?part:part.toUpperCase();
_125=_121;
}
_125("previousSibling",part,_124,_122,_126,_123);
}},find:{ID:function(_127,_128,_129){
if(typeof _128.getElementById!=="undefined"&&!_129){
var m=_128.getElementById(_127[1]);
return m?[m]:[];
}
},NAME:function(_12a,_12b,_12c){
if(typeof _12b.getElementsByName!=="undefined"){
var ret=[],_12d=_12b.getElementsByName(_12a[1]);
for(var i=0,l=_12d.length;i<l;i++){
if(_12d[i].getAttribute("name")===_12a[1]){
ret.push(_12d[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_12e,_12f){
return _12f.getElementsByTagName(_12e[1]);
}},preFilter:{CLASS:function(_130,_131,_132,_133,not,_134){
_130=" "+_130[1].replace(/\\/g,"")+" ";
if(_134){
return _130;
}
for(var i=0,elem;(elem=_131[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_130)>=0)){
if(!_132){
_133.push(elem);
}
}else{
if(_132){
_131[i]=false;
}
}
}
}
return false;
},ID:function(_135){
return _135[1].replace(/\\/g,"");
},TAG:function(_136,_137){
for(var i=0;_137[i]===false;i++){
}
return _137[i]&&_100(_137[i])?_136[1]:_136[1].toUpperCase();
},CHILD:function(_138){
if(_138[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_138[2]=="even"&&"2n"||_138[2]=="odd"&&"2n+1"||!(/\D/).test(_138[2])&&"0n+"+_138[2]||_138[2]);
_138[2]=(test[1]+(test[2]||1))-0;
_138[3]=test[3]-0;
}
_138[0]=_f0++;
return _138;
},ATTR:function(_139,_13a,_13b,_13c,not,_13d){
var name=_139[1].replace(/\\/g,"");
if(!_13d&&Expr.attrMap[name]){
_139[1]=Expr.attrMap[name];
}
if(_139[2]==="~="){
_139[4]=" "+_139[4]+" ";
}
return _139;
},PSEUDO:function(_13e,_13f,_140,_141,not){
if(_13e[1]==="not"){
if(_13e[3].match(_ef).length>1||(/^\w/).test(_13e[3])){
_13e[3]=_f3(_13e[3],null,null,_13f);
}else{
var ret=_f3.filter(_13e[3],_13f,_140,true^not);
if(!_140){
_141.push.apply(_141,ret);
}
return false;
}
}else{
if(Expr.match.POS.test(_13e[0])||Expr.match.CHILD.test(_13e[0])){
return true;
}
}
return _13e;
},POS:function(_142){
_142.unshift(true);
return _142;
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
},has:function(elem,i,_143){
return !!_f3(_143[3],elem).length;
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
},last:function(elem,i,_144,_145){
return i===_145.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_146){
return i<_146[3]-0;
},gt:function(elem,i,_147){
return i>_147[3]-0;
},nth:function(elem,i,_148){
return _148[3]-0==i;
},eq:function(elem,i,_149){
return _149[3]-0==i;
}},filter:{PSEUDO:function(elem,_14a,i,_14b){
var name=_14a[1],_14c=Expr.filters[name];
if(_14c){
return _14c(elem,i,_14a,_14b);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_14a[3])>=0;
}else{
if(name==="not"){
var not=_14a[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_14d){
var type=_14d[1],node=elem;
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
var _14e=_14d[2],last=_14d[3];
if(_14e==1&&last==0){
return true;
}
var _14f=_14d[0],_150=elem.parentNode;
if(_150&&(_150.sizcache!==_14f||!elem.nodeIndex)){
var _151=0;
for(node=_150.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_151;
}
}
_150.sizcache=_14f;
}
var diff=elem.nodeIndex-last;
if(_14e==0){
return diff==0;
}else{
return (diff%_14e==0&&diff/_14e>=0);
}
}
},ID:function(elem,_152){
return elem.nodeType===1&&elem.getAttribute("id")===_152;
},TAG:function(elem,_153){
return (_153==="*"&&elem.nodeType===1)||elem.nodeName===_153;
},CLASS:function(elem,_154){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_154)>-1;
},ATTR:function(elem,_155){
var name=_155[1],_156=Expr.attrHandle[name]?Expr.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_157=_156+"",type=_155[2],_158=_155[4];
return _156==null?type==="!=":type==="="?_157===_158:type==="*="?_157.indexOf(_158)>=0:type==="~="?(" "+_157+" ").indexOf(_158)>=0:!_158?_157&&_156!==false:type==="!="?_157!=_158:type==="^="?_157.indexOf(_158)===0:type==="$="?_157.substr(_157.length-_158.length)===_158:type==="|="?_157===_158||_157.substr(0,_158.length+1)===_158+"-":false;
},POS:function(elem,_159,i,_15a){
var name=_159[2],_15b=Expr.setFilters[name];
if(_15b){
return _15b(elem,i,_159,_15a);
}
}}};
var _101=Expr.match.POS;
for(var type in Expr.match){
Expr.match[type]=new RegExp(Expr.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _103=function(_15c,_15d){
_15c=Array.prototype.slice.call(_15c);
if(_15d){
_15d.push.apply(_15d,_15c);
return _15d;
}
return _15c;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_103=function(_15e,_15f){
var ret=_15f||[];
if(_f1.call(_15e)==="[object Array]"){
Array.prototype.push.apply(ret,_15e);
}else{
if(typeof _15e.length==="number"){
for(var i=0,l=_15e.length;i<l;i++){
ret.push(_15e[i]);
}
}else{
for(var i=0;_15e[i];i++){
ret.push(_15e[i]);
}
}
}
return ret;
};
}
var _106;
if(document.documentElement.compareDocumentPosition){
_106=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_f2=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_106=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_f2=true;
}
return ret;
};
}else{
if(document.createRange){
_106=function(a,b){
var _160=a.ownerDocument.createRange(),_161=b.ownerDocument.createRange();
_160.selectNode(a);
_160.collapse(true);
_161.selectNode(b);
_161.collapse(true);
var ret=_160.compareBoundaryPoints(Range.START_TO_END,_161);
if(ret===0){
_f2=true;
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
Expr.find.ID=function(_162,_163,_164){
if(typeof _163.getElementById!=="undefined"&&!_164){
var m=_163.getElementById(_162[1]);
return m?m.id===_162[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_162[1]?[m]:undefined:[];
}
};
Expr.filter.ID=function(elem,_165){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_165;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
Expr.find.TAG=function(_166,_167){
var _168=_167.getElementsByTagName(_166[1]);
if(_166[1]==="*"){
var tmp=[];
for(var i=0;_168[i];i++){
if(_168[i].nodeType===1){
tmp.push(_168[i]);
}
}
_168=tmp;
}
return _168;
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
var _169=_f3,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_f3=function(_16a,_16b,_16c,seed){
_16b=_16b||document;
if(!seed&&_16b.nodeType===9&&!_100(_16b)){
try{
return _103(_16b.querySelectorAll(_16a),_16c);
}
catch(e){
}
}
return _169(_16a,_16b,_16c,seed);
};
for(var prop in _169){
_f3[prop]=_169[prop];
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
Expr.find.CLASS=function(_16d,_16e,_16f){
if(typeof _16e.getElementsByClassName!=="undefined"&&!_16f){
return _16e.getElementsByClassName(_16d[1]);
}
};
})();
}
function _121(dir,cur,_170,_171,_172,_173){
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
if(elem.nodeType===1&&!_173){
elem.sizcache=_170;
elem.sizset=i;
}
if(elem.nodeName===cur){
_175=elem;
break;
}
elem=elem[dir];
}
_171[i]=_175;
}
}
};
function _11f(dir,cur,_176,_177,_178,_179){
var _17a=dir=="previousSibling"&&!_179;
for(var i=0,l=_177.length;i<l;i++){
var elem=_177[i];
if(elem){
if(_17a&&elem.nodeType===1){
elem.sizcache=_176;
elem.sizset=i;
}
elem=elem[dir];
var _17b=false;
while(elem){
if(elem.sizcache===_176){
_17b=_177[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_179){
elem.sizcache=_176;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_17b=true;
break;
}
}else{
if(_f3.filter(cur,[elem]).length>0){
_17b=elem;
break;
}
}
}
elem=elem[dir];
}
_177[i]=_17b;
}
}
};
var _104=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _100=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _102=function(_17c,_17d){
var _17e=[],_17f="",_180,root=_17d.nodeType?[_17d]:_17d;
while((_180=Expr.match.PSEUDO.exec(_17c))){
_17f+=_180[0];
_17c=_17c.replace(Expr.match.PSEUDO,"");
}
_17c=Expr.relative[_17c]?_17c+"*":_17c;
for(var i=0,l=root.length;i<l;i++){
_f3(_17c,root[i],_17e);
}
return _f3.filter(_17f,_17e);
};
Playdar.Util.select=_f3;
})();
