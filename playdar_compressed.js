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
},parse_microformats:function(_18){
var _19=[];
var _1a=Playdar.Util.select(".haudio",_18);
for(var i=0;i<_1a.length;i++){
var _1b=_1a[i];
var _1c=Playdar.Util.select(".contributor",_1b);
var _1d=Playdar.Util.select(".fn",_1b);
if(_1d[0]&&_1c[0]){
var _1e={"artist":_1c[0].title||_1c[0].innerHTML,"name":_1d[0].title||_1d[0].innerHTML,"element":_1b};
_19.push(_1e);
}
}
return _19;
},autodetect:function(_1f,_20){
if(!this.is_authed()){
return false;
}
var _21,qid;
var _22=this.parse_microformats(_20);
for(var i=0;i<_22.length;i++){
_21=_22[i];
if(_1f){
qid=_1f(_21);
}
Playdar.client.resolve(_21.artist,"",_21.name,qid);
}
},resolve:function(_23,_24,_25,qid,url){
if(!this.is_authed()){
return false;
}
var _26={artist:_23||"",album:_24||"",track:_25||"",url:url||"",qid:qid||Playdar.Util.generate_uuid()};
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.resolution_queue.push(_26);
this.process_resolution_queue();
},process_resolution_queue:function(){
if(this.resolutions_in_progress.count>=Playdar.MAX_CONCURRENT_RESOLUTIONS){
return false;
}
var _27=this.resolution_queue.length+this.resolutions_in_progress.count;
if(_27){
var _28=Playdar.MAX_CONCURRENT_RESOLUTIONS-this.resolutions_in_progress.count;
for(var i=1;i<=_28;i++){
var _29=this.resolution_queue.shift();
if(!_29){
break;
}
this.resolutions_in_progress.queries[_29.qid]=_29;
this.resolutions_in_progress.count++;
Playdar.Util.loadjs(this.get_url("resolve","handle_resolution",_29));
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
var _2a={qid:qid};
this.resolutions_in_progress.queries[qid]=_2a;
this.resolutions_in_progress.count++;
this.handle_resolution(_2a);
},handle_resolution:function(_2b){
if(this.resolutions_in_progress.queries[_2b.qid]){
this.last_qid=_2b.qid;
this.resolve_qids.push(this.last_qid);
this.get_results(_2b.qid);
}
},get_results:function(qid){
if(this.resolutions_in_progress.queries[qid]){
if(!this.poll_counts[qid]){
this.poll_counts[qid]=0;
}
this.poll_counts[qid]++;
Playdar.Util.loadjs(this.get_url("get_results","handle_results",{qid:qid,poll:this.poll_counts[qid]}));
}
},poll_results:function(_2c,_2d,_2e){
var _2f=this.should_stop_polling(_2c);
_2e=_2e||this;
if(!_2f){
setTimeout(function(){
_2d.call(_2e,_2c.qid);
},_2c.poll_interval||_2c.refresh_interval);
}
return _2f;
},should_stop_polling:function(_30){
if(_30.poll_interval<=0||_30.refresh_interval<=0){
return true;
}
if(_30.query.solved==true){
return true;
}
if(this.poll_counts[_30.qid]>=(_30.poll_limit||Playdar.MAX_POLLS)){
return true;
}
return false;
},handle_results:function(_31){
if(this.resolutions_in_progress.queries[_31.qid]){
var _32=this.poll_results(_31,this.get_results);
if(Playdar.status_bar){
Playdar.status_bar.handle_results(_31,_32);
}
if(this.results_handlers[_31.qid]){
this.results_handlers[_31.qid](_31,_32);
}else{
this.listeners.onResults(_31,_32);
}
if(_32){
delete this.resolutions_in_progress.queries[_31.qid];
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
},get_base_url:function(_33,_34){
var url="http://"+Playdar.SERVER_ROOT+":"+Playdar.SERVER_PORT;
if(_33){
url+=_33;
}
if(_34){
url+="?"+Playdar.Util.toQueryString(_34);
}
return url;
},get_url:function(_35,_36,_37){
_37=_37||{};
_37.call_id=new Date().getTime();
_37.method=_35;
if(!_37.jsonp){
if(_36.join){
_37.jsonp=_36.join(".");
}else{
_37.jsonp=this.jsonp_callback(_36);
}
}
this.add_auth_token(_37);
return this.get_base_url("/api/",_37);
},add_auth_token:function(_38){
if(this.is_authed()){
_38.auth=this.auth_token;
}
return _38;
},get_stream_url:function(sid){
return this.get_base_url("/sid/"+sid);
},jsonp_callback:function(_39){
return "Playdar.client."+_39;
},list_results:function(_3a){
for(var i=0;i<_3a.results.length;i++){
console.log(_3a.results[i].name);
}
}};
Playdar.Boffin=function(){
Playdar.boffin=this;
};
Playdar.Boffin.prototype={get_url:function(_3b,_3c){
_3c=_3c||{};
_3c.call_id=new Date().getTime();
_3c.jsonp=_3c.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_3c);
return Playdar.client.get_base_url("/boffin/"+_3b,_3c);
},get_tagcloud:function(){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
Playdar.Util.loadjs(this.get_url("tagcloud",{jsonp:"Playdar.boffin.handle_tagcloud"}));
},handle_tagcloud:function(_3d){
Playdar.client.register_results_handler(Playdar.client.listeners.onTagCloud,_3d.qid);
Playdar.client.get_results(_3d.qid);
},get_tag_rql:function(tag){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
var rql="tag:\""+tag+"\"";
Playdar.Util.loadjs(this.get_url("rql/"+encodeURIComponent(rql),{jsonp:"Playdar.boffin.handle_rql"}));
},handle_rql:function(_3e){
Playdar.client.register_results_handler(Playdar.client.listeners.onRQL,_3e.qid);
Playdar.client.get_results(_3e.qid);
}};
Playdar.Scrobbler=function(){
Playdar.scrobbler=this;
};
Playdar.Scrobbler.prototype={get_url:function(_3f,_40){
_40=_40||{};
_40.call_id=new Date().getTime();
_40.jsonp=_40.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_40);
return Playdar.client.get_base_url("/audioscrobbler/"+_3f,_40);
},start:function(_41,_42,_43,_44,_45,_46){
var _47={a:_41,t:_42,o:"P"};
if(_43){
_47["b"]=_43;
}
if(_44){
_47["l"]=_44;
}
if(_45){
_47["n"]=_45;
}
if(_46){
_47["m"]=_46;
}
Playdar.Util.loadjs(this.get_url("start",_47));
},stop:function(){
Playdar.Util.loadjs(this.get_url("stop"));
},pause:function(){
Playdar.Util.loadjs(this.get_url("pause"));
},resume:function(){
Playdar.Util.loadjs(this.get_url("resume"));
},get_sound_callbacks:function(_48){
var _49=this;
return {onload:function(){
if(this.readyState==2){
_49.stop();
this.unload();
}
},onplay:function(){
this.scrobbleStart=true;
},onpause:function(){
_49.pause();
},onresume:function(){
_49.resume();
},onfinish:function(){
if(!this.chained){
_49.stop();
}
},whileplaying:function(){
if(this.scrobbleStart){
this.scrobbleStart=false;
_49.start(_48.artist,_48.track,_48.album,_48.duration);
}
}};
}};
Playdar.Player=function(_4a){
Playdar.player=this;
this.streams={};
this.nowplayingid=null;
this.soundmanager=_4a;
};
Playdar.Player.MPEG4_MIMETYPES={"audio/mp4":true,"audio/aac":true,"audio/x-aac":true,"audio/x-m4a":true,"audio/x-m4b":true};
Playdar.Player.prototype={register_stream:function(_4b,_4c){
if(this.streams[_4b.sid]){
return false;
}
this.streams[_4b.sid]=_4b;
var _4d=Playdar.Util.extend_object({id:"s_"+_4b.sid,url:Playdar.client.get_stream_url(_4b.sid),isMovieStar:Playdar.Player.MPEG4_MIMETYPES[_4b.mimetype]==true,bufferTime:2},_4c);
var _4e=[_4c];
if(Playdar.status_bar){
_4e.push(Playdar.status_bar.get_sound_callbacks(_4b));
}
if(Playdar.scrobbler){
_4e.push(Playdar.scrobbler.get_sound_callbacks(_4b));
}
Playdar.Util.extend_object(_4d,Playdar.Util.merge_callback_options(_4e));
try{
var _4f=this.soundmanager.createSound(_4d);
}
catch(e){
return false;
}
return _4f;
},play_stream:function(sid){
var _50=this.soundmanager.getSoundById("s_"+sid);
if(this.nowplayingid!=sid){
this.stop_current();
if(_50.playState==0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_50.togglePause();
return _50;
},stop_current:function(_51){
if(_51){
if(Playdar.scrobbler){
Playdar.scrobbler.stop();
}
}
console.info("STOP: "+this.nowplayingid);
if(this.nowplayingid){
var _52=this.soundmanager.getSoundById("s_"+this.nowplayingid);
_52.stop();
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
var _53=document.createElement("div");
_53.style.position="fixed";
_53.style.bottom=0;
_53.style.left=0;
_53.style.zIndex=100;
_53.style.width="100%";
_53.style.height="36px";
_53.style.padding="7px 0";
_53.style.borderTop="2px solid #4c7a0f";
_53.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_53.style.color="#335507";
_53.style.background="#e8f9bb";
var _54=document.createElement("div");
_54.style.padding="0 7px";
var _55="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_54.innerHTML=_55;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_54.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _56=document.createElement("p");
_56.style.margin="0";
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
_56.appendChild(this.track_link);
this.playback.appendChild(_56);
var _57=document.createElement("table");
_57.setAttribute("cellpadding",0);
_57.setAttribute("cellspacing",0);
_57.setAttribute("border",0);
_57.style.color="#4c7a0f";
_57.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _58=document.createElement("tbody");
var _59=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_59.appendChild(this.track_elapsed);
var _5a=document.createElement("td");
_5a.style.padding="0 5px";
_5a.style.verticalAlign="middle";
var _5b=document.createElement("div");
_5b.style.width=this.progress_bar_width+"px";
_5b.style.height="9px";
_5b.style.border="1px solid #4c7a0f";
_5b.style.background="#fff";
_5b.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_5b.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_5b.appendChild(this.playhead);
_5b.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_5a.appendChild(_5b);
_59.appendChild(_5a);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_59.appendChild(this.track_duration);
_58.appendChild(_59);
_57.appendChild(_58);
this.playback.appendChild(_57);
_54.appendChild(this.playback);
var _5c=document.createElement("div");
_5c.style.cssFloat="right";
_5c.style.padding="0 8px";
_5c.style.textAlign="right";
var _5d=document.createElement("p");
_5d.style.margin=0;
_5d.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_5c.appendChild(_5d);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML=Playdar.client.get_disconnect_link_html();
_5c.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_53.appendChild(_5c);
_53.appendChild(_54);
document.body.appendChild(_53);
var _5e=document.body.style.marginBottom;
if(!_5e){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_5e=css.marginBottom;
}
}
document.body.style.marginBottom=(_5e.replace("px","")-0)+36+(7*2)+2+"px";
return _53;
},ready:function(){
this.playdar_links.style.display="";
var _5f="Ready";
this.status.innerHTML=_5f;
},offline:function(){
this.playdar_links.style.display="none";
var _60=Playdar.client.get_auth_link_html();
this.status.innerHTML=_60;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _61="manualAuth_"+Playdar.client.uuid;
var _62="<input type=\"text\" id=\""+_61+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_61+"'); return false;"+"\" />";
this.status.innerHTML=_62;
},handle_stat:function(_63){
if(_63.authenticated){
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
var _64=" ";
if(this.pending_count){
_64+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_64+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_64;
}
},handle_results:function(_65,_66){
if(_66){
this.pending_count--;
if(_65.results.length){
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
},get_sound_callbacks:function(_67){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
}};
},play_handler:function(_68){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_68.sid);
this.track_link.title=_68.source;
this.track_name.innerHTML=_68.track;
this.artist_name.innerHTML=_68.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_68.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_69){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_69.position/1000));
var _6a;
if(_69.readyState==3){
_6a=_69.duration;
}else{
_6a=_69.durationEstimate;
}
var _6b=_69.position/_6a;
this.playhead.style.width=Math.round(_6b*this.progress_bar_width)+"px";
this.loading_handler(_69);
},loading_handler:function(_6c){
var _6d=_6c.bytesLoaded/_6c.bytesTotal;
this.bufferhead.style.width=Math.round(_6d*this.progress_bar_width)+"px";
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
var _6e="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _6f=[];
var rnd=Math.random;
var r;
_6f[8]=_6f[13]=_6f[18]=_6f[23]="-";
_6f[14]="4";
for(var i=0;i<36;i++){
if(!_6f[i]){
r=0|rnd()*16;
_6f[i]=_6e[(i==19)?(r&3)|8:r&15];
}
}
return _6f.join("");
},toQueryPair:function(key,_70){
if(_70===null){
return key;
}
return key+"="+encodeURIComponent(_70);
},toQueryString:function(_71){
var _72=[];
for(var key in _71){
var _73=_71[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_73)=="[object Array]"){
for(var i=0;i<_73.length;i++){
_72.push(Playdar.Util.toQueryPair(key,_73[i]));
}
}else{
_72.push(Playdar.Util.toQueryPair(key,_73));
}
}
return _72.join("&");
},mmss:function(_74){
var s=_74%60;
if(s<10){
s="0"+s;
}
return Math.floor(_74/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_75,_76,_77){
if(_77){
var _78=new Date();
_78.setTime(_78.getTime()+(_77*24*60*60*1000));
var _79="; expires="+_78.toGMTString();
}else{
var _79="";
}
document.cookie=_75+"="+_76+_79+"; path=/";
},getcookie:function(_7a){
var _7b=_7a+"=";
var _7c=document.cookie.split(";");
for(var i=0;i<_7c.length;i++){
var c=_7c[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_7b)==0){
return c.substring(_7b.length,c.length);
}
}
return null;
},deletecookie:function(_7d){
Playdar.Util.setcookie(_7d,"",-1);
},get_window_position:function(){
var _7e={};
if(window.screenLeft){
_7e.x=window.screenLeft||0;
_7e.y=window.screenTop||0;
}else{
_7e.x=window.screenX||0;
_7e.y=window.screenY||0;
}
return _7e;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_7f){
var _80=Playdar.Util.get_popup_location(_7f);
return ["left="+_80.x,"top="+_80.y,"width="+_7f.w,"height="+_7f.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_81){
var _82=Playdar.Util.get_window_position();
var _83=Playdar.Util.get_window_size();
return {"x":Math.max(0,_82.x+(_83.w-_81.w)/2),"y":Math.max(0,_82.y+(_83.h-_81.h)/2)};
},addEvent:function(obj,_84,fn){
if(obj.attachEvent){
obj["e"+_84+fn]=fn;
obj[_84+fn]=function(){
obj["e"+_84+fn](window.event);
};
obj.attachEvent("on"+_84,obj[_84+fn]);
}else{
obj.addEventListener(_84,fn,false);
}
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_85,_86){
_86=_86||{};
for(var _87 in _86){
_85[_87]=_86[_87];
}
return _85;
},merge_callback_options:function(_88){
var _89={};
var _8a=[];
var i,_8b,_8c;
for(i=0;i<_88.length;i++){
_8b=_88[i];
for(_8c in _8b){
if(typeof (_8b[_8c])=="function"){
if(!_89[_8c]){
_8a.push(_8c);
_89[_8c]=[];
}
_89[_8c].push(_8b);
}
}
}
var _8d={};
var key,_8e;
for(i=0;i<_8a.length;i++){
var key=_8a[i];
_8d[key]=(function(key,_8f){
return function(){
for(var j=0;j<_8f.length;j++){
_8f[j][key].apply(this,arguments);
}
};
})(key,_89[key]);
}
return _8d;
},log:function(_90){
if(typeof console!="undefined"){
console.dir(_90);
}
},null_callback:function(){
}};
Playdar.Util.addEvent(window,"beforeunload",Playdar.unload);
(function(){
var _91=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_92=0,_93=Object.prototype.toString,_94=false;
var _95=function(_96,_97,_98,_99){
_98=_98||[];
var _9a=_97=_97||document;
if(_97.nodeType!==1&&_97.nodeType!==9){
return [];
}
if(!_96||typeof _96!=="string"){
return _98;
}
var _9b=[],m,set,_9c,_9d,_9e,_9f,_a0=true,_a1=_a2(_97);
_91.lastIndex=0;
while((m=_91.exec(_96))!==null){
_9b.push(m[1]);
if(m[2]){
_9f=RegExp.rightContext;
break;
}
}
if(_9b.length>1&&_a3.exec(_96)){
if(_9b.length===2&&_a4.relative[_9b[0]]){
set=_a5(_9b[0]+_9b[1],_97);
}else{
set=_a4.relative[_9b[0]]?[_97]:_95(_9b.shift(),_97);
while(_9b.length){
_96=_9b.shift();
if(_a4.relative[_96]){
_96+=_9b.shift();
}
set=_a5(_96,set);
}
}
}else{
if(!_99&&_9b.length>1&&_97.nodeType===9&&!_a1&&_a4.match.ID.test(_9b[0])&&!_a4.match.ID.test(_9b[_9b.length-1])){
var ret=_95.find(_9b.shift(),_97,_a1);
_97=ret.expr?_95.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_97){
var ret=_99?{expr:_9b.pop(),set:_a6(_99)}:_95.find(_9b.pop(),_9b.length===1&&(_9b[0]==="~"||_9b[0]==="+")&&_97.parentNode?_97.parentNode:_97,_a1);
set=ret.expr?_95.filter(ret.expr,ret.set):ret.set;
if(_9b.length>0){
_9c=_a6(set);
}else{
_a0=false;
}
while(_9b.length){
var cur=_9b.pop(),pop=cur;
if(!_a4.relative[cur]){
cur="";
}else{
pop=_9b.pop();
}
if(pop==null){
pop=_97;
}
_a4.relative[cur](_9c,pop,_a1);
}
}else{
_9c=_9b=[];
}
}
if(!_9c){
_9c=set;
}
if(!_9c){
throw "Syntax error, unrecognized expression: "+(cur||_96);
}
if(_93.call(_9c)==="[object Array]"){
if(!_a0){
_98.push.apply(_98,_9c);
}else{
if(_97&&_97.nodeType===1){
for(var i=0;_9c[i]!=null;i++){
if(_9c[i]&&(_9c[i]===true||_9c[i].nodeType===1&&_a7(_97,_9c[i]))){
_98.push(set[i]);
}
}
}else{
for(var i=0;_9c[i]!=null;i++){
if(_9c[i]&&_9c[i].nodeType===1){
_98.push(set[i]);
}
}
}
}
}else{
_a6(_9c,_98);
}
if(_9f){
_95(_9f,_9a,_98,_99);
_95.uniqueSort(_98);
}
return _98;
};
_95.uniqueSort=function(_a8){
if(_a9){
_94=false;
_a8.sort(_a9);
if(_94){
for(var i=1;i<_a8.length;i++){
if(_a8[i]===_a8[i-1]){
_a8.splice(i--,1);
}
}
}
}
};
_95.matches=function(_aa,set){
return _95(_aa,null,null,set);
};
_95.find=function(_ab,_ac,_ad){
var set,_ae;
if(!_ab){
return [];
}
for(var i=0,l=_a4.order.length;i<l;i++){
var _af=_a4.order[i],_ae;
if((_ae=_a4.match[_af].exec(_ab))){
var _b0=RegExp.leftContext;
if(_b0.substr(_b0.length-1)!=="\\"){
_ae[1]=(_ae[1]||"").replace(/\\/g,"");
set=_a4.find[_af](_ae,_ac,_ad);
if(set!=null){
_ab=_ab.replace(_a4.match[_af],"");
break;
}
}
}
}
if(!set){
set=_ac.getElementsByTagName("*");
}
return {set:set,expr:_ab};
};
_95.filter=function(_b1,set,_b2,not){
var old=_b1,_b3=[],_b4=set,_b5,_b6,_b7=set&&set[0]&&_a2(set[0]);
while(_b1&&set.length){
for(var _b8 in _a4.filter){
if((_b5=_a4.match[_b8].exec(_b1))!=null){
var _b9=_a4.filter[_b8],_ba,_bb;
_b6=false;
if(_b4==_b3){
_b3=[];
}
if(_a4.preFilter[_b8]){
_b5=_a4.preFilter[_b8](_b5,_b4,_b2,_b3,not,_b7);
if(!_b5){
_b6=_ba=true;
}else{
if(_b5===true){
continue;
}
}
}
if(_b5){
for(var i=0;(_bb=_b4[i])!=null;i++){
if(_bb){
_ba=_b9(_bb,_b5,i,_b4);
var _bc=not^!!_ba;
if(_b2&&_ba!=null){
if(_bc){
_b6=true;
}else{
_b4[i]=false;
}
}else{
if(_bc){
_b3.push(_bb);
_b6=true;
}
}
}
}
}
if(_ba!==undefined){
if(!_b2){
_b4=_b3;
}
_b1=_b1.replace(_a4.match[_b8],"");
if(!_b6){
return [];
}
break;
}
}
}
if(_b1==old){
if(_b6==null){
throw "Syntax error, unrecognized expression: "+_b1;
}else{
break;
}
}
old=_b1;
}
return _b4;
};
var _a4=_95.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(_bd){
return _bd.getAttribute("href");
}},relative:{"+":function(_be,_bf,_c0){
var _c1=typeof _bf==="string",_c2=_c1&&!(/\W/).test(_bf),_c3=_c1&&!_c2;
if(_c2&&!_c0){
_bf=_bf.toUpperCase();
}
for(var i=0,l=_be.length,_c4;i<l;i++){
if((_c4=_be[i])){
while((_c4=_c4.previousSibling)&&_c4.nodeType!==1){
}
_be[i]=_c3||_c4&&_c4.nodeName===_bf?_c4||false:_c4===_bf;
}
}
if(_c3){
_95.filter(_bf,_be,true);
}
},">":function(_c5,_c6,_c7){
var _c8=typeof _c6==="string";
if(_c8&&!(/\W/).test(_c6)){
_c6=_c7?_c6:_c6.toUpperCase();
for(var i=0,l=_c5.length;i<l;i++){
var _c9=_c5[i];
if(_c9){
var _ca=_c9.parentNode;
_c5[i]=_ca.nodeName===_c6?_ca:false;
}
}
}else{
for(var i=0,l=_c5.length;i<l;i++){
var _c9=_c5[i];
if(_c9){
_c5[i]=_c8?_c9.parentNode:_c9.parentNode===_c6;
}
}
if(_c8){
_95.filter(_c6,_c5,true);
}
}
},"":function(_cb,_cc,_cd){
var _ce=_92++,_cf=_d0;
if(!_cc.match(/\W/)){
var _d1=_cc=_cd?_cc:_cc.toUpperCase();
_cf=_d2;
}
_cf("parentNode",_cc,_ce,_cb,_d1,_cd);
},"~":function(_d3,_d4,_d5){
var _d6=_92++,_d7=_d0;
if(typeof _d4==="string"&&!_d4.match(/\W/)){
var _d8=_d4=_d5?_d4:_d4.toUpperCase();
_d7=_d2;
}
_d7("previousSibling",_d4,_d6,_d3,_d8,_d5);
}},find:{ID:function(_d9,_da,_db){
if(typeof _da.getElementById!=="undefined"&&!_db){
var m=_da.getElementById(_d9[1]);
return m?[m]:[];
}
},NAME:function(_dc,_dd,_de){
if(typeof _dd.getElementsByName!=="undefined"){
var ret=[],_df=_dd.getElementsByName(_dc[1]);
for(var i=0,l=_df.length;i<l;i++){
if(_df[i].getAttribute("name")===_dc[1]){
ret.push(_df[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_e0,_e1){
return _e1.getElementsByTagName(_e0[1]);
}},preFilter:{CLASS:function(_e2,_e3,_e4,_e5,not,_e6){
_e2=" "+_e2[1].replace(/\\/g,"")+" ";
if(_e6){
return _e2;
}
for(var i=0,_e7;(_e7=_e3[i])!=null;i++){
if(_e7){
if(not^(_e7.className&&(" "+_e7.className+" ").indexOf(_e2)>=0)){
if(!_e4){
_e5.push(_e7);
}
}else{
if(_e4){
_e3[i]=false;
}
}
}
}
return false;
},ID:function(_e8){
return _e8[1].replace(/\\/g,"");
},TAG:function(_e9,_ea){
for(var i=0;_ea[i]===false;i++){
}
return _ea[i]&&_a2(_ea[i])?_e9[1]:_e9[1].toUpperCase();
},CHILD:function(_eb){
if(_eb[1]=="nth"){
var _ec=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_eb[2]=="even"&&"2n"||_eb[2]=="odd"&&"2n+1"||!(/\D/).test(_eb[2])&&"0n+"+_eb[2]||_eb[2]);
_eb[2]=(_ec[1]+(_ec[2]||1))-0;
_eb[3]=_ec[3]-0;
}
_eb[0]=_92++;
return _eb;
},ATTR:function(_ed,_ee,_ef,_f0,not,_f1){
var _f2=_ed[1].replace(/\\/g,"");
if(!_f1&&_a4.attrMap[_f2]){
_ed[1]=_a4.attrMap[_f2];
}
if(_ed[2]==="~="){
_ed[4]=" "+_ed[4]+" ";
}
return _ed;
},PSEUDO:function(_f3,_f4,_f5,_f6,not){
if(_f3[1]==="not"){
if(_f3[3].match(_91).length>1||(/^\w/).test(_f3[3])){
_f3[3]=_95(_f3[3],null,null,_f4);
}else{
var ret=_95.filter(_f3[3],_f4,_f5,true^not);
if(!_f5){
_f6.push.apply(_f6,ret);
}
return false;
}
}else{
if(_a4.match.POS.test(_f3[0])||_a4.match.CHILD.test(_f3[0])){
return true;
}
}
return _f3;
},POS:function(_f7){
_f7.unshift(true);
return _f7;
}},filters:{enabled:function(_f8){
return _f8.disabled===false&&_f8.type!=="hidden";
},disabled:function(_f9){
return _f9.disabled===true;
},checked:function(_fa){
return _fa.checked===true;
},selected:function(_fb){
_fb.parentNode.selectedIndex;
return _fb.selected===true;
},parent:function(_fc){
return !!_fc.firstChild;
},empty:function(_fd){
return !_fd.firstChild;
},has:function(_fe,i,_ff){
return !!_95(_ff[3],_fe).length;
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
},last:function(elem,i,_100,_101){
return i===_101.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_102){
return i<_102[3]-0;
},gt:function(elem,i,_103){
return i>_103[3]-0;
},nth:function(elem,i,_104){
return _104[3]-0==i;
},eq:function(elem,i,_105){
return _105[3]-0==i;
}},filter:{PSEUDO:function(elem,_106,i,_107){
var name=_106[1],_108=_a4.filters[name];
if(_108){
return _108(elem,i,_106,_107);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_106[3])>=0;
}else{
if(name==="not"){
var not=_106[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_109){
var type=_109[1],node=elem;
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
var _10a=_109[2],last=_109[3];
if(_10a==1&&last==0){
return true;
}
var _10b=_109[0],_10c=elem.parentNode;
if(_10c&&(_10c.sizcache!==_10b||!elem.nodeIndex)){
var _10d=0;
for(node=_10c.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_10d;
}
}
_10c.sizcache=_10b;
}
var diff=elem.nodeIndex-last;
if(_10a==0){
return diff==0;
}else{
return (diff%_10a==0&&diff/_10a>=0);
}
}
},ID:function(elem,_10e){
return elem.nodeType===1&&elem.getAttribute("id")===_10e;
},TAG:function(elem,_10f){
return (_10f==="*"&&elem.nodeType===1)||elem.nodeName===_10f;
},CLASS:function(elem,_110){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_110)>-1;
},ATTR:function(elem,_111){
var name=_111[1],_112=_a4.attrHandle[name]?_a4.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_113=_112+"",type=_111[2],_114=_111[4];
return _112==null?type==="!=":type==="="?_113===_114:type==="*="?_113.indexOf(_114)>=0:type==="~="?(" "+_113+" ").indexOf(_114)>=0:!_114?_113&&_112!==false:type==="!="?_113!=_114:type==="^="?_113.indexOf(_114)===0:type==="$="?_113.substr(_113.length-_114.length)===_114:type==="|="?_113===_114||_113.substr(0,_114.length+1)===_114+"-":false;
},POS:function(elem,_115,i,_116){
var name=_115[2],_117=_a4.setFilters[name];
if(_117){
return _117(elem,i,_115,_116);
}
}}};
var _a3=_a4.match.POS;
for(var type in _a4.match){
_a4.match[type]=new RegExp(_a4.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _a6=function(_118,_119){
_118=Array.prototype.slice.call(_118);
if(_119){
_119.push.apply(_119,_118);
return _119;
}
return _118;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_a6=function(_11a,_11b){
var ret=_11b||[];
if(_93.call(_11a)==="[object Array]"){
Array.prototype.push.apply(ret,_11a);
}else{
if(typeof _11a.length==="number"){
for(var i=0,l=_11a.length;i<l;i++){
ret.push(_11a[i]);
}
}else{
for(var i=0;_11a[i];i++){
ret.push(_11a[i]);
}
}
}
return ret;
};
}
var _a9;
if(document.documentElement.compareDocumentPosition){
_a9=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_94=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_a9=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_94=true;
}
return ret;
};
}else{
if(document.createRange){
_a9=function(a,b){
var _11c=a.ownerDocument.createRange(),_11d=b.ownerDocument.createRange();
_11c.selectNode(a);
_11c.collapse(true);
_11d.selectNode(b);
_11d.collapse(true);
var ret=_11c.compareBoundaryPoints(Range.START_TO_END,_11d);
if(ret===0){
_94=true;
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
_a4.find.ID=function(_11e,_11f,_120){
if(typeof _11f.getElementById!=="undefined"&&!_120){
var m=_11f.getElementById(_11e[1]);
return m?m.id===_11e[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_11e[1]?[m]:undefined:[];
}
};
_a4.filter.ID=function(elem,_121){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_121;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_a4.find.TAG=function(_122,_123){
var _124=_123.getElementsByTagName(_122[1]);
if(_122[1]==="*"){
var tmp=[];
for(var i=0;_124[i];i++){
if(_124[i].nodeType===1){
tmp.push(_124[i]);
}
}
_124=tmp;
}
return _124;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_a4.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _125=_95,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_95=function(_126,_127,_128,seed){
_127=_127||document;
if(!seed&&_127.nodeType===9&&!_a2(_127)){
try{
return _a6(_127.querySelectorAll(_126),_128);
}
catch(e){
}
}
return _125(_126,_127,_128,seed);
};
for(var prop in _125){
_95[prop]=_125[prop];
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
_a4.order.splice(1,0,"CLASS");
_a4.find.CLASS=function(_129,_12a,_12b){
if(typeof _12a.getElementsByClassName!=="undefined"&&!_12b){
return _12a.getElementsByClassName(_129[1]);
}
};
})();
}
function _d2(dir,cur,_12c,_12d,_12e,_12f){
var _130=dir=="previousSibling"&&!_12f;
for(var i=0,l=_12d.length;i<l;i++){
var elem=_12d[i];
if(elem){
if(_130&&elem.nodeType===1){
elem.sizcache=_12c;
elem.sizset=i;
}
elem=elem[dir];
var _131=false;
while(elem){
if(elem.sizcache===_12c){
_131=_12d[elem.sizset];
break;
}
if(elem.nodeType===1&&!_12f){
elem.sizcache=_12c;
elem.sizset=i;
}
if(elem.nodeName===cur){
_131=elem;
break;
}
elem=elem[dir];
}
_12d[i]=_131;
}
}
};
function _d0(dir,cur,_132,_133,_134,_135){
var _136=dir=="previousSibling"&&!_135;
for(var i=0,l=_133.length;i<l;i++){
var elem=_133[i];
if(elem){
if(_136&&elem.nodeType===1){
elem.sizcache=_132;
elem.sizset=i;
}
elem=elem[dir];
var _137=false;
while(elem){
if(elem.sizcache===_132){
_137=_133[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_135){
elem.sizcache=_132;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_137=true;
break;
}
}else{
if(_95.filter(cur,[elem]).length>0){
_137=elem;
break;
}
}
}
elem=elem[dir];
}
_133[i]=_137;
}
}
};
var _a7=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _a2=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _a5=function(_138,_139){
var _13a=[],_13b="",_13c,root=_139.nodeType?[_139]:_139;
while((_13c=_a4.match.PSEUDO.exec(_138))){
_13b+=_13c[0];
_138=_138.replace(_a4.match.PSEUDO,"");
}
_138=_a4.relative[_138]?_138+"*":_138;
for(var i=0,l=root.length;i<l;i++){
_95(_138,root[i],_13a);
}
return _95.filter(_13b,_13a);
};
Playdar.Util.select=_95;
})();

