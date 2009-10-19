Playdar={VERSION:"0.4.4",SERVER_ROOT:"localhost",SERVER_PORT:"60210",STATIC_HOST:"http://www.playdar.org",STAT_TIMEOUT:2000,AUTH_POPUP_NAME:"PD_auth",AUTH_POPUP_SIZE:{"w":500,"h":260},QUERIES_POPUP_NAME:"PD_queries",QUERIES_POPUP_SIZE:{"w":640,"h":700},MAX_POLLS:4,MAX_CONCURRENT_RESOLUTIONS:5,USE_STATUS_BAR:true,USE_SCROBBLER:true,client:null,status_bar:null,player:null,setup:function(_1){
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
this.auth_token=Playdar.Util.getcookie("auth");
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
Playdar.Util.deletecookie("auth");
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
Playdar.Util.setcookie("auth",_15,365);
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
var _1c=_1a[i];
var _1d=Playdar.Util.select(".contributor",_1c);
var _1e=Playdar.Util.select(".fn",_1c);
if(_1e[0]&&_1d[0]){
var _1f={"artist":_1d[0].title||_1d[0].innerHTML,"name":_1e[0].title||_1e[0].innerHTML,"element":_1c};
_19.push(_1f);
}
}
return _19;
},autodetect:function(_20,_21){
if(!this.is_authed()){
return false;
}
var _22,qid;
var _24=this.parse_microformats(_21);
for(var i=0;i<_24.length;i++){
_22=_24[i];
if(_20){
qid=_20(_22);
}
Playdar.client.resolve(_22.artist,"",_22.name,qid);
}
},resolve:function(_26,_27,_28,qid,url){
if(!this.is_authed()){
return false;
}
var _2b={artist:_26||"",album:_27||"",track:_28||"",url:url||"",qid:qid||Playdar.Util.generate_uuid()};
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.resolution_queue.push(_2b);
this.process_resolution_queue();
},process_resolution_queue:function(){
if(this.resolutions_in_progress.count>=Playdar.MAX_CONCURRENT_RESOLUTIONS){
return false;
}
var _2c=this.resolution_queue.length+this.resolutions_in_progress.count;
if(_2c){
var _2d=Playdar.MAX_CONCURRENT_RESOLUTIONS-this.resolutions_in_progress.count;
for(var i=1;i<=_2d;i++){
var _2f=this.resolution_queue.shift();
if(!_2f){
break;
}
this.resolutions_in_progress.queries[_2f.qid]=_2f;
this.resolutions_in_progress.count++;
Playdar.Util.loadjs(this.get_url("resolve","handle_resolution",_2f));
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
var _31={qid:qid};
this.resolutions_in_progress.queries[qid]=_31;
this.resolutions_in_progress.count++;
this.handle_resolution(_31);
},handle_resolution:function(_32){
if(this.resolutions_in_progress.queries[_32.qid]){
this.last_qid=_32.qid;
this.resolve_qids.push(this.last_qid);
this.get_results(_32.qid);
}
},get_results:function(qid){
if(this.resolutions_in_progress.queries[qid]){
if(!this.poll_counts[qid]){
this.poll_counts[qid]=0;
}
this.poll_counts[qid]++;
Playdar.Util.loadjs(this.get_url("get_results","handle_results",{qid:qid,poll:this.poll_counts[qid]}));
}
},poll_results:function(_34,_35,_36){
var _37=this.should_stop_polling(_34);
_36=_36||this;
if(!_37){
setTimeout(function(){
_35.call(_36,_34.qid);
},_34.poll_interval||_34.refresh_interval);
}
return _37;
},should_stop_polling:function(_38){
if(_38.poll_interval<=0||_38.refresh_interval<=0){
return true;
}
if(_38.query.solved==true){
return true;
}
if(this.poll_counts[_38.qid]>=(_38.poll_limit||Playdar.MAX_POLLS)){
return true;
}
return false;
},handle_results:function(_39){
if(this.resolutions_in_progress.queries[_39.qid]){
var _3a=this.poll_results(_39,this.get_results);
if(Playdar.status_bar){
Playdar.status_bar.handle_results(_39,_3a);
}
if(this.results_handlers[_39.qid]){
this.results_handlers[_39.qid](_39,_3a);
}else{
this.listeners.onResults(_39,_3a);
}
if(_3a){
delete this.resolutions_in_progress.queries[_39.qid];
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
},get_base_url:function(_3b,_3c){
var url="http://"+Playdar.SERVER_ROOT+":"+Playdar.SERVER_PORT;
if(_3b){
url+=_3b;
}
if(_3c){
url+="?"+Playdar.Util.toQueryString(_3c);
}
return url;
},get_url:function(_3e,_3f,_40){
_40=_40||{};
_40.call_id=new Date().getTime();
_40.method=_3e;
if(!_40.jsonp){
if(_3f.join){
_40.jsonp=_3f.join(".");
}else{
_40.jsonp=this.jsonp_callback(_3f);
}
}
this.add_auth_token(_40);
return this.get_base_url("/api/",_40);
},add_auth_token:function(_41){
if(this.is_authed()){
_41.auth=this.auth_token;
}
return _41;
},get_stream_url:function(sid){
return this.get_base_url("/sid/"+sid);
},jsonp_callback:function(_43){
return "Playdar.client."+_43;
},list_results:function(_44){
for(var i=0;i<_44.results.length;i++){
console.log(_44.results[i].name);
}
}};
Playdar.Boffin=function(){
Playdar.boffin=this;
};
Playdar.Boffin.prototype={get_url:function(_46,_47){
_47=_47||{};
_47.call_id=new Date().getTime();
_47.jsonp=_47.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_47);
return Playdar.client.get_base_url("/boffin/"+_46,_47);
},get_tagcloud:function(){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
Playdar.Util.loadjs(this.get_url("tagcloud",{jsonp:"Playdar.boffin.handle_tagcloud"}));
},handle_tagcloud:function(_48){
Playdar.client.register_results_handler(Playdar.client.listeners.onTagCloud,_48.qid);
Playdar.client.get_results(_48.qid);
},get_tag_rql:function(tag){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
var rql="tag:\""+tag+"\"";
Playdar.Util.loadjs(this.get_url("rql/"+encodeURIComponent(rql),{jsonp:"Playdar.boffin.handle_rql"}));
},handle_rql:function(_4b){
Playdar.client.register_results_handler(Playdar.client.listeners.onRQL,_4b.qid);
Playdar.client.get_results(_4b.qid);
}};
Playdar.Scrobbler=function(){
Playdar.scrobbler=this;
};
Playdar.Scrobbler.prototype={get_url:function(_4c,_4d){
_4d=_4d||{};
_4d.call_id=new Date().getTime();
_4d.jsonp=_4d.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_4d);
return Playdar.client.get_base_url("/audioscrobbler/"+_4c,_4d);
},start:function(_4e,_4f,_50,_51,_52,_53){
var _54={a:_4e,t:_4f,o:"P"};
if(_50){
_54["b"]=_50;
}
if(_51){
_54["l"]=_51;
}
if(_52){
_54["n"]=_52;
}
if(_53){
_54["m"]=_53;
}
Playdar.Util.loadjs(this.get_url("start",_54));
},stop:function(){
Playdar.Util.loadjs(this.get_url("stop"));
},pause:function(){
Playdar.Util.loadjs(this.get_url("pause"));
},resume:function(){
Playdar.Util.loadjs(this.get_url("resume"));
},get_sound_callbacks:function(_55){
var _56=this;
return {onload:function(){
if(this.readyState==2){
_56.stop();
this.unload();
}
},onplay:function(){
this.scrobbleStart=true;
},onpause:function(){
_56.pause();
},onresume:function(){
_56.resume();
},onfinish:function(){
if(!this.chained){
_56.stop();
}
},whileplaying:function(){
if(this.scrobbleStart){
this.scrobbleStart=false;
_56.start(_55.artist,_55.track,_55.album,_55.duration);
}
}};
}};
Playdar.Player=function(_57){
Playdar.player=this;
this.streams={};
this.nowplayingid=null;
this.soundmanager=_57;
};
Playdar.Player.prototype={register_stream:function(_58,_59){
if(this.streams[_58.sid]){
return false;
}
this.streams[_58.sid]=_58;
var _5a=Playdar.Util.extend_object({id:_58.sid,url:Playdar.client.get_stream_url(_58.sid),isMovieStar:(_58.mimetype=="audio/mp4")},_59);
var _5b=[_59];
if(Playdar.status_bar){
_5b.push(Playdar.status_bar.get_sound_callbacks(_58));
}
if(Playdar.scrobbler){
_5b.push(Playdar.scrobbler.get_sound_callbacks(_58));
}
Playdar.Util.extend_object(_5a,Playdar.Util.merge_callback_options(_5b));
try{
var _5c=this.soundmanager.createSound(_5a);
}
catch(e){
return false;
}
return _5c;
},play_stream:function(sid){
var _5e=this.soundmanager.getSoundById(sid);
if(this.nowplayingid!=sid){
this.stop_current();
if(_5e.playState==0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_5e.togglePause();
return _5e;
},stop_current:function(_5f){
if(_5f){
if(Playdar.scrobbler){
Playdar.scrobbler.stop();
}
}
if(this.nowplayingid){
var _60=this.soundmanager.getSoundById(this.nowplayingid);
_60.stop();
_60.setPosition(1);
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
var _62=document.createElement("div");
_62.style.position="fixed";
_62.style.bottom=0;
_62.style.left=0;
_62.style.zIndex=100;
_62.style.width="100%";
_62.style.height="36px";
_62.style.padding="7px 0";
_62.style.borderTop="2px solid #4c7a0f";
_62.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_62.style.color="#335507";
_62.style.background="#e8f9bb";
var _63=document.createElement("div");
_63.style.padding="0 7px";
var _64="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_63.innerHTML=_64;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_63.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _65=document.createElement("p");
_65.style.margin="0";
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
_65.appendChild(this.track_link);
this.playback.appendChild(_65);
var _66=document.createElement("table");
_66.setAttribute("cellpadding",0);
_66.setAttribute("cellspacing",0);
_66.setAttribute("border",0);
_66.style.color="#4c7a0f";
_66.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _67=document.createElement("tbody");
var _68=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_68.appendChild(this.track_elapsed);
var _69=document.createElement("td");
_69.style.padding="0 5px";
_69.style.verticalAlign="middle";
var _6a=document.createElement("div");
_6a.style.width=this.progress_bar_width+"px";
_6a.style.height="9px";
_6a.style.border="1px solid #4c7a0f";
_6a.style.background="#fff";
_6a.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_6a.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_6a.appendChild(this.playhead);
_6a.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_69.appendChild(_6a);
_68.appendChild(_69);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_68.appendChild(this.track_duration);
_67.appendChild(_68);
_66.appendChild(_67);
this.playback.appendChild(_66);
_63.appendChild(this.playback);
var _6b=document.createElement("div");
_6b.style.cssFloat="right";
_6b.style.padding="0 8px";
_6b.style.textAlign="right";
var _6c=document.createElement("p");
_6c.style.margin=0;
_6c.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_6b.appendChild(_6c);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML=Playdar.client.get_disconnect_link_html();
_6b.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_62.appendChild(_6b);
_62.appendChild(_63);
document.body.appendChild(_62);
var _6d=document.body.style.marginBottom;
if(!_6d){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_6d=css.marginBottom;
}
}
document.body.style.marginBottom=(_6d.replace("px","")-0)+36+(7*2)+2+"px";
return _62;
},ready:function(){
this.playdar_links.style.display="";
var _6f="Ready";
this.status.innerHTML=_6f;
},offline:function(){
this.playdar_links.style.display="none";
var _70=Playdar.client.get_auth_link_html();
this.status.innerHTML=_70;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _71="manualAuth_"+Playdar.client.uuid;
var _72="<input type=\"text\" id=\""+_71+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_71+"'); return false;"+"\" />";
this.status.innerHTML=_72;
},handle_stat:function(_73){
if(_73.authenticated){
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
var _74=" ";
if(this.pending_count){
_74+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_74+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_74;
}
},handle_results:function(_75,_76){
if(_76){
this.pending_count--;
if(_75.results.length){
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
},get_sound_callbacks:function(_77){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
}};
},play_handler:function(_78){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_78.sid);
this.track_link.title=_78.source;
this.track_name.innerHTML=_78.track;
this.artist_name.innerHTML=_78.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_78.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_79){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_79.position/1000));
var _7a;
if(_79.readyState==3){
_7a=_79.duration;
}else{
_7a=_79.durationEstimate;
}
var _7b=_79.position/_7a;
this.playhead.style.width=Math.round(_7b*this.progress_bar_width)+"px";
this.loading_handler(_79);
},loading_handler:function(_7c){
var _7d=_7c.bytesLoaded/_7c.bytesTotal;
this.bufferhead.style.width=Math.round(_7d*this.progress_bar_width)+"px";
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
var _7e="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _7f=[];
var rnd=Math.random;
var r;
_7f[8]=_7f[13]=_7f[18]=_7f[23]="-";
_7f[14]="4";
for(var i=0;i<36;i++){
if(!_7f[i]){
r=0|rnd()*16;
_7f[i]=_7e[(i==19)?(r&3)|8:r&15];
}
}
return _7f.join("");
},toQueryPair:function(key,_84){
if(_84===null){
return key;
}
return key+"="+encodeURIComponent(_84);
},toQueryString:function(_85){
var _86=[];
for(var key in _85){
var _88=_85[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_88)=="[object Array]"){
for(var i=0;i<_88.length;i++){
_86.push(Playdar.Util.toQueryPair(key,_88[i]));
}
}else{
_86.push(Playdar.Util.toQueryPair(key,_88));
}
}
return _86.join("&");
},mmss:function(_8a){
var s=_8a%60;
if(s<10){
s="0"+s;
}
return Math.floor(_8a/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_8e,_8f,_90){
if(_90){
var _91=new Date();
_91.setTime(_91.getTime()+(_90*24*60*60*1000));
var _92="; expires="+_91.toGMTString();
}else{
var _92="";
}
document.cookie="PD_"+_8e+"="+_8f+_92+"; path=/";
},getcookie:function(_93){
var _94="PD_"+_93+"=";
var _95=document.cookie.split(";");
for(var i=0;i<_95.length;i++){
var c=_95[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_94)==0){
return c.substring(_94.length,c.length);
}
}
return null;
},deletecookie:function(_98){
Playdar.Util.setcookie(_98,"",-1);
},get_window_position:function(){
var _99={};
if(window.screenLeft){
_99.x=window.screenLeft||0;
_99.y=window.screenTop||0;
}else{
_99.x=window.screenX||0;
_99.y=window.screenY||0;
}
return _99;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_9a){
var _9b=Playdar.Util.get_popup_location(_9a);
return ["left="+_9b.x,"top="+_9b.y,"width="+_9a.w,"height="+_9a.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_9c){
var _9d=Playdar.Util.get_window_position();
var _9e=Playdar.Util.get_window_size();
return {"x":Math.max(0,_9d.x+(_9e.w-_9c.w)/2),"y":Math.max(0,_9d.y+(_9e.h-_9c.h)/2)};
},addEvent:function(obj,_a0,fn){
if(obj.attachEvent){
obj["e"+_a0+fn]=fn;
obj[_a0+fn]=function(){
obj["e"+_a0+fn](window.event);
};
obj.attachEvent("on"+_a0,obj[_a0+fn]);
}else{
obj.addEventListener(_a0,fn,false);
}
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_a3,_a4){
_a4=_a4||{};
for(var _a5 in _a4){
_a3[_a5]=_a4[_a5];
}
return _a3;
},merge_callback_options:function(_a6){
var _a7={};
var _a8=[];
var i,_aa,_ab;
for(i=0;i<_a6.length;i++){
_aa=_a6[i];
for(_ab in _aa){
if(typeof (_aa[_ab])=="function"){
if(!_a7[_ab]){
_a8.push(_ab);
_a7[_ab]=[];
}
_a7[_ab].push(_aa);
}
}
}
var _ac={};
var key,_ae;
for(i=0;i<_a8.length;i++){
var key=_a8[i];
_ac[key]=(function(key,_b0){
return function(){
for(var j=0;j<_b0.length;j++){
_b0[j][key].apply(this,arguments);
}
};
})(key,_a7[key]);
}
return _ac;
},log:function(_b2){
if(typeof console!="undefined"){
console.dir(_b2);
}
},null_callback:function(){
}};
Playdar.Util.addEvent(window,"beforeunload",Playdar.unload);
(function(){
var _b3=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_b4=0,_b5=Object.prototype.toString,_b6=false;
var _b7=function(_b8,_b9,_ba,_bb){
_ba=_ba||[];
var _bc=_b9=_b9||document;
if(_b9.nodeType!==1&&_b9.nodeType!==9){
return [];
}
if(!_b8||typeof _b8!=="string"){
return _ba;
}
var _bd=[],m,set,_c0,_c1,_c2,_c3,_c4=true,_c5=_c6(_b9);
_b3.lastIndex=0;
while((m=_b3.exec(_b8))!==null){
_bd.push(m[1]);
if(m[2]){
_c3=RegExp.rightContext;
break;
}
}
if(_bd.length>1&&_c7.exec(_b8)){
if(_bd.length===2&&_c8.relative[_bd[0]]){
set=_c9(_bd[0]+_bd[1],_b9);
}else{
set=_c8.relative[_bd[0]]?[_b9]:_b7(_bd.shift(),_b9);
while(_bd.length){
_b8=_bd.shift();
if(_c8.relative[_b8]){
_b8+=_bd.shift();
}
set=_c9(_b8,set);
}
}
}else{
if(!_bb&&_bd.length>1&&_b9.nodeType===9&&!_c5&&_c8.match.ID.test(_bd[0])&&!_c8.match.ID.test(_bd[_bd.length-1])){
var ret=_b7.find(_bd.shift(),_b9,_c5);
_b9=ret.expr?_b7.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_b9){
var ret=_bb?{expr:_bd.pop(),set:_cb(_bb)}:_b7.find(_bd.pop(),_bd.length===1&&(_bd[0]==="~"||_bd[0]==="+")&&_b9.parentNode?_b9.parentNode:_b9,_c5);
set=ret.expr?_b7.filter(ret.expr,ret.set):ret.set;
if(_bd.length>0){
_c0=_cb(set);
}else{
_c4=false;
}
while(_bd.length){
var cur=_bd.pop(),pop=cur;
if(!_c8.relative[cur]){
cur="";
}else{
pop=_bd.pop();
}
if(pop==null){
pop=_b9;
}
_c8.relative[cur](_c0,pop,_c5);
}
}else{
_c0=_bd=[];
}
}
if(!_c0){
_c0=set;
}
if(!_c0){
throw "Syntax error, unrecognized expression: "+(cur||_b8);
}
if(_b5.call(_c0)==="[object Array]"){
if(!_c4){
_ba.push.apply(_ba,_c0);
}else{
if(_b9&&_b9.nodeType===1){
for(var i=0;_c0[i]!=null;i++){
if(_c0[i]&&(_c0[i]===true||_c0[i].nodeType===1&&_cf(_b9,_c0[i]))){
_ba.push(set[i]);
}
}
}else{
for(var i=0;_c0[i]!=null;i++){
if(_c0[i]&&_c0[i].nodeType===1){
_ba.push(set[i]);
}
}
}
}
}else{
_cb(_c0,_ba);
}
if(_c3){
_b7(_c3,_bc,_ba,_bb);
_b7.uniqueSort(_ba);
}
return _ba;
};
_b7.uniqueSort=function(_d0){
if(_d1){
_b6=false;
_d0.sort(_d1);
if(_b6){
for(var i=1;i<_d0.length;i++){
if(_d0[i]===_d0[i-1]){
_d0.splice(i--,1);
}
}
}
}
};
_b7.matches=function(_d3,set){
return _b7(_d3,null,null,set);
};
_b7.find=function(_d5,_d6,_d7){
var set,_d9;
if(!_d5){
return [];
}
for(var i=0,l=_c8.order.length;i<l;i++){
var _dc=_c8.order[i],_d9;
if((_d9=_c8.match[_dc].exec(_d5))){
var _dd=RegExp.leftContext;
if(_dd.substr(_dd.length-1)!=="\\"){
_d9[1]=(_d9[1]||"").replace(/\\/g,"");
set=_c8.find[_dc](_d9,_d6,_d7);
if(set!=null){
_d5=_d5.replace(_c8.match[_dc],"");
break;
}
}
}
}
if(!set){
set=_d6.getElementsByTagName("*");
}
return {set:set,expr:_d5};
};
_b7.filter=function(_de,set,_e0,not){
var old=_de,_e3=[],_e4=set,_e5,_e6,_e7=set&&set[0]&&_c6(set[0]);
while(_de&&set.length){
for(var _e8 in _c8.filter){
if((_e5=_c8.match[_e8].exec(_de))!=null){
var _e9=_c8.filter[_e8],_ea,_eb;
_e6=false;
if(_e4==_e3){
_e3=[];
}
if(_c8.preFilter[_e8]){
_e5=_c8.preFilter[_e8](_e5,_e4,_e0,_e3,not,_e7);
if(!_e5){
_e6=_ea=true;
}else{
if(_e5===true){
continue;
}
}
}
if(_e5){
for(var i=0;(_eb=_e4[i])!=null;i++){
if(_eb){
_ea=_e9(_eb,_e5,i,_e4);
var _ed=not^!!_ea;
if(_e0&&_ea!=null){
if(_ed){
_e6=true;
}else{
_e4[i]=false;
}
}else{
if(_ed){
_e3.push(_eb);
_e6=true;
}
}
}
}
}
if(_ea!==undefined){
if(!_e0){
_e4=_e3;
}
_de=_de.replace(_c8.match[_e8],"");
if(!_e6){
return [];
}
break;
}
}
}
if(_de==old){
if(_e6==null){
throw "Syntax error, unrecognized expression: "+_de;
}else{
break;
}
}
old=_de;
}
return _e4;
};
var _c8=_b7.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(_ee){
return _ee.getAttribute("href");
}},relative:{"+":function(_ef,_f0,_f1){
var _f2=typeof _f0==="string",_f3=_f2&&!(/\W/).test(_f0),_f4=_f2&&!_f3;
if(_f3&&!_f1){
_f0=_f0.toUpperCase();
}
for(var i=0,l=_ef.length,_f7;i<l;i++){
if((_f7=_ef[i])){
while((_f7=_f7.previousSibling)&&_f7.nodeType!==1){
}
_ef[i]=_f4||_f7&&_f7.nodeName===_f0?_f7||false:_f7===_f0;
}
}
if(_f4){
_b7.filter(_f0,_ef,true);
}
},">":function(_f8,_f9,_fa){
var _fb=typeof _f9==="string";
if(_fb&&!(/\W/).test(_f9)){
_f9=_fa?_f9:_f9.toUpperCase();
for(var i=0,l=_f8.length;i<l;i++){
var _fe=_f8[i];
if(_fe){
var _ff=_fe.parentNode;
_f8[i]=_ff.nodeName===_f9?_ff:false;
}
}
}else{
for(var i=0,l=_f8.length;i<l;i++){
var _fe=_f8[i];
if(_fe){
_f8[i]=_fb?_fe.parentNode:_fe.parentNode===_f9;
}
}
if(_fb){
_b7.filter(_f9,_f8,true);
}
}
},"":function(_100,part,_102){
var _103=_b4++,_104=dirCheck;
if(!part.match(/\W/)){
var _105=part=_102?part:part.toUpperCase();
_104=dirNodeCheck;
}
_104("parentNode",part,_103,_100,_105,_102);
},"~":function(_106,part,_108){
var _109=_b4++,_10a=dirCheck;
if(typeof part==="string"&&!part.match(/\W/)){
var _10b=part=_108?part:part.toUpperCase();
_10a=dirNodeCheck;
}
_10a("previousSibling",part,_109,_106,_10b,_108);
}},find:{ID:function(_10c,_10d,_10e){
if(typeof _10d.getElementById!=="undefined"&&!_10e){
var m=_10d.getElementById(_10c[1]);
return m?[m]:[];
}
},NAME:function(_110,_111,_112){
if(typeof _111.getElementsByName!=="undefined"){
var ret=[],_114=_111.getElementsByName(_110[1]);
for(var i=0,l=_114.length;i<l;i++){
if(_114[i].getAttribute("name")===_110[1]){
ret.push(_114[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_117,_118){
return _118.getElementsByTagName(_117[1]);
}},preFilter:{CLASS:function(_119,_11a,_11b,_11c,not,_11e){
_119=" "+_119[1].replace(/\\/g,"")+" ";
if(_11e){
return _119;
}
for(var i=0,elem;(elem=_11a[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_119)>=0)){
if(!_11b){
_11c.push(elem);
}
}else{
if(_11b){
_11a[i]=false;
}
}
}
}
return false;
},ID:function(_121){
return _121[1].replace(/\\/g,"");
},TAG:function(_122,_123){
for(var i=0;_123[i]===false;i++){
}
return _123[i]&&_c6(_123[i])?_122[1]:_122[1].toUpperCase();
},CHILD:function(_125){
if(_125[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_125[2]=="even"&&"2n"||_125[2]=="odd"&&"2n+1"||!(/\D/).test(_125[2])&&"0n+"+_125[2]||_125[2]);
_125[2]=(test[1]+(test[2]||1))-0;
_125[3]=test[3]-0;
}
_125[0]=_b4++;
return _125;
},ATTR:function(_127,_128,_129,_12a,not,_12c){
var name=_127[1].replace(/\\/g,"");
if(!_12c&&_c8.attrMap[name]){
_127[1]=_c8.attrMap[name];
}
if(_127[2]==="~="){
_127[4]=" "+_127[4]+" ";
}
return _127;
},PSEUDO:function(_12e,_12f,_130,_131,not){
if(_12e[1]==="not"){
if(_12e[3].match(_b3).length>1||(/^\w/).test(_12e[3])){
_12e[3]=_b7(_12e[3],null,null,_12f);
}else{
var ret=_b7.filter(_12e[3],_12f,_130,true^not);
if(!_130){
_131.push.apply(_131,ret);
}
return false;
}
}else{
if(_c8.match.POS.test(_12e[0])||_c8.match.CHILD.test(_12e[0])){
return true;
}
}
return _12e;
},POS:function(_134){
_134.unshift(true);
return _134;
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
return !!_b7(_13d[3],elem).length;
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
},last:function(elem,i,_14d,_14e){
return i===_14e.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_155){
return i<_155[3]-0;
},gt:function(elem,i,_158){
return i>_158[3]-0;
},nth:function(elem,i,_15b){
return _15b[3]-0==i;
},eq:function(elem,i,_15e){
return _15e[3]-0==i;
}},filter:{PSEUDO:function(elem,_160,i,_162){
var name=_160[1],_164=_c8.filters[name];
if(_164){
return _164(elem,i,_160,_162);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_160[3])>=0;
}else{
if(name==="not"){
var not=_160[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_168){
var type=_168[1],node=elem;
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
var _16b=_168[2],last=_168[3];
if(_16b==1&&last==0){
return true;
}
var _16d=_168[0],_16e=elem.parentNode;
if(_16e&&(_16e.sizcache!==_16d||!elem.nodeIndex)){
var _16f=0;
for(node=_16e.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_16f;
}
}
_16e.sizcache=_16d;
}
var diff=elem.nodeIndex-last;
if(_16b==0){
return diff==0;
}else{
return (diff%_16b==0&&diff/_16b>=0);
}
}
},ID:function(elem,_172){
return elem.nodeType===1&&elem.getAttribute("id")===_172;
},TAG:function(elem,_174){
return (_174==="*"&&elem.nodeType===1)||elem.nodeName===_174;
},CLASS:function(elem,_176){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_176)>-1;
},ATTR:function(elem,_178){
var name=_178[1],_17a=_c8.attrHandle[name]?_c8.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_17b=_17a+"",type=_178[2],_17d=_178[4];
return _17a==null?type==="!=":type==="="?_17b===_17d:type==="*="?_17b.indexOf(_17d)>=0:type==="~="?(" "+_17b+" ").indexOf(_17d)>=0:!_17d?_17b&&_17a!==false:type==="!="?_17b!=_17d:type==="^="?_17b.indexOf(_17d)===0:type==="$="?_17b.substr(_17b.length-_17d.length)===_17d:type==="|="?_17b===_17d||_17b.substr(0,_17d.length+1)===_17d+"-":false;
},POS:function(elem,_17f,i,_181){
var name=_17f[2],_183=_c8.setFilters[name];
if(_183){
return _183(elem,i,_17f,_181);
}
}}};
var _c7=_c8.match.POS;
for(var type in _c8.match){
_c8.match[type]=new RegExp(_c8.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _cb=function(_185,_186){
_185=Array.prototype.slice.call(_185);
if(_186){
_186.push.apply(_186,_185);
return _186;
}
return _185;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_cb=function(_187,_188){
var ret=_188||[];
if(_b5.call(_187)==="[object Array]"){
Array.prototype.push.apply(ret,_187);
}else{
if(typeof _187.length==="number"){
for(var i=0,l=_187.length;i<l;i++){
ret.push(_187[i]);
}
}else{
for(var i=0;_187[i];i++){
ret.push(_187[i]);
}
}
}
return ret;
};
}
var _d1;
if(document.documentElement.compareDocumentPosition){
_d1=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_b6=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_d1=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_b6=true;
}
return ret;
};
}else{
if(document.createRange){
_d1=function(a,b){
var _194=a.ownerDocument.createRange(),_195=b.ownerDocument.createRange();
_194.selectNode(a);
_194.collapse(true);
_195.selectNode(b);
_195.collapse(true);
var ret=_194.compareBoundaryPoints(Range.START_TO_END,_195);
if(ret===0){
_b6=true;
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
_c8.find.ID=function(_19a,_19b,_19c){
if(typeof _19b.getElementById!=="undefined"&&!_19c){
var m=_19b.getElementById(_19a[1]);
return m?m.id===_19a[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_19a[1]?[m]:undefined:[];
}
};
_c8.filter.ID=function(elem,_19f){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_19f;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_c8.find.TAG=function(_1a2,_1a3){
var _1a4=_1a3.getElementsByTagName(_1a2[1]);
if(_1a2[1]==="*"){
var tmp=[];
for(var i=0;_1a4[i];i++){
if(_1a4[i].nodeType===1){
tmp.push(_1a4[i]);
}
}
_1a4=tmp;
}
return _1a4;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_c8.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _1a8=_b7,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_b7=function(_1aa,_1ab,_1ac,seed){
_1ab=_1ab||document;
if(!seed&&_1ab.nodeType===9&&!_c6(_1ab)){
try{
return _cb(_1ab.querySelectorAll(_1aa),_1ac);
}
catch(e){
}
}
return _1a8(_1aa,_1ab,_1ac,seed);
};
for(var prop in _1a8){
_b7[prop]=_1a8[prop];
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
_c8.order.splice(1,0,"CLASS");
_c8.find.CLASS=function(_1b0,_1b1,_1b2){
if(typeof _1b1.getElementsByClassName!=="undefined"&&!_1b2){
return _1b1.getElementsByClassName(_1b0[1]);
}
};
})();
}
function dirNodeCheck(dir,cur,_1b5,_1b6,_1b7,_1b8){
var _1b9=dir=="previousSibling"&&!_1b8;
for(var i=0,l=_1b6.length;i<l;i++){
var elem=_1b6[i];
if(elem){
if(_1b9&&elem.nodeType===1){
elem.sizcache=_1b5;
elem.sizset=i;
}
elem=elem[dir];
var _1bd=false;
while(elem){
if(elem.sizcache===_1b5){
_1bd=_1b6[elem.sizset];
break;
}
if(elem.nodeType===1&&!_1b8){
elem.sizcache=_1b5;
elem.sizset=i;
}
if(elem.nodeName===cur){
_1bd=elem;
break;
}
elem=elem[dir];
}
_1b6[i]=_1bd;
}
}
}
function dirCheck(dir,cur,_1c0,_1c1,_1c2,_1c3){
var _1c4=dir=="previousSibling"&&!_1c3;
for(var i=0,l=_1c1.length;i<l;i++){
var elem=_1c1[i];
if(elem){
if(_1c4&&elem.nodeType===1){
elem.sizcache=_1c0;
elem.sizset=i;
}
elem=elem[dir];
var _1c8=false;
while(elem){
if(elem.sizcache===_1c0){
_1c8=_1c1[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_1c3){
elem.sizcache=_1c0;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_1c8=true;
break;
}
}else{
if(_b7.filter(cur,[elem]).length>0){
_1c8=elem;
break;
}
}
}
elem=elem[dir];
}
_1c1[i]=_1c8;
}
}
}
var _cf=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _c6=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _c9=function(_1ce,_1cf){
var _1d0=[],_1d1="",_1d2,root=_1cf.nodeType?[_1cf]:_1cf;
while((_1d2=_c8.match.PSEUDO.exec(_1ce))){
_1d1+=_1d2[0];
_1ce=_1ce.replace(_c8.match.PSEUDO,"");
}
_1ce=_c8.relative[_1ce]?_1ce+"*":_1ce;
for(var i=0,l=root.length;i<l;i++){
_b7(_1ce,root[i],_1d0);
}
return _b7.filter(_1d1,_1d0);
};
Playdar.Util.select=_b7;
})();

