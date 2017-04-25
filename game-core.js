//-------- improve existing objects

Math.TAU = Math.PI * 2;

Array.prototype.eradicate = function(e){	//remove all occurences of e from array
	var i;
	while (true){
		i = this.indexOf(e);
		if (i >= 0)
			this.splice(i, 1);
		else
			break;
	}
}

Object.assign = Object.assign || function(target){
	'use strict';
	if (target === undefined || target === null){
		throw new TypeError('Cannot convert undefined or null to object');
	}
	var output = Object(target);
	for (var index = 1; index < arguments.length; index++){
		var source = arguments[index];
		if (source !== undefined && source !== null){
			for (var nextKey in source){
				if (Object.prototype.hasOwnProperty.call(source, nextKey)){
					output[nextKey] = source[nextKey];
				}
			}
		}
	}
	return output;
};

//-------- useful objects

function EventList(){}
EventList.prototype = Object.create(Array.prototype);
EventList.prototype.push = function(e){
	if (this.indexOf(e) === -1) Array.prototype.push.call(this, e);
}

function BGM(loop, start){
	this.bgm_loop = loop;
	if (start === undefined || start === null){
		this.bgm_start = null;
	}else{
		this.bgm_start = start;
		//make it automatically switch to the looping part
		this.bgm_start.addEventListener("ended", function(){
			this.bgm_start.currentTime = 0;
			this.bgm_loop.currentTime = 0;
			this.bgm_loop.play();
		}.bind(this), false);
	}
	//set up looping
	if (typeof this.bgm_loop.loop === "boolean"){
		this.bgm_loop.loop = true;
	}else{
		this.bgm_loop.addEventListener("ended", function(){
			this.currentTime = 0;
			this.play();
		}, false);
	}
}

BGM.prototype.play = function(){
	if (this.bgm_start){
		if (this.bgm_loop.currentTime > 0){
			this.bgm_loop.pause();
			this.bgm_loop.currentTime = 0;
		}
		this.bgm_start.currentTime = 0;
		this.bgm_start.play();
	}else{
		this.bgm_loop.currentTime = 0;
		this.bgm_loop.play();
	}
}

BGM.prototype.stop = function(){
	if (this.bgm_start && this.bgm_start.currentTime > 0){
		this.bgm_start.pause();
		this.bgm_start.currentTime = 0;
	}
	if (this.bgm_loop.currentTime > 0){
		this.bgm_loop.pause();
		this.bgm_loop.currentTime = 0;
	}
}

BGM.prototype.pause = function(){
	if (this.bgm_start && this.bgm_start.currentTime > 0)
		this.bgm_start.pause();
	if (this.bgm_loop.currentTime > 0)
		this.bgm_loop.pause();
}

BGM.prototype.resume = function(){
	if (this.bgm_loop.currentTime > 0)
		this.bgm_loop.play();
	else if (this.bgm_start)
		this.bgm_start.play();
}

//-------- resource handler

function Resource(game){this.game = game}

Resource.prototype.imgs = {};
Resource.prototype.snds = {};
Resource.prototype.data = {};

Resource.prototype.load_imgs = function(names, cb, ext){
	var i, name, img, remaining = names.length-1;
	ext = ext || ".png";
	for (i = 0; i < names.length; i++){
		name = names[i];
		img = new Image();
		img.addEventListener("load", function(){
			Resource.prototype.imgs[name] = img;
			if (remaining > 0){
				remaining -= 1;
			}else{
				if (cb !== undefined && cb !== null) cb();
			}
		}, false);
		img.src = name+ext;
	}
}

Resource.prototype.load_snds = function(names, cb, ext){
	var i, name, img, remaining = names.length-1;
	ext = ext || ".ogg";
	for (i = 0; i < names.length; i++){
		name = names[i];
		img = new Audio();
		img.addEventListener("load", function(){
			Resource.prototype.imgs[name] = img;
			if (remaining > 0){
				remaining -= 1;
			}else{
				if (cb !== undefined && cb !== null) cb();
			}
		}, false);
		img.src = name+ext;
	}
}

Resource.prototype.load_data = function(names, cb){
	var i, name, req, remaining = names.length-1;
	for (i = 0; i < names.length; i++){
		name = names[i];
		req = new XMLHttpRequest();
		req.open("get", name+".json", true);
		req.responseType = "json";
		req.addEventListener("load", function(){
			Resource.prototype.data[name] = this.response;
			if (remaining > 0){
				remaining -= 1;
			}else{
				if (cb !== undefined && cb !== null) cb();
			}
		}, false);
		req.send();
	}
}

//-------- game object
//usage:
// - define Game.prototype.init()
//   if loading things with Resource, increment game.loading_progress and provide cb = game.run.bind(game)
// - define Game.prototype.update(dt), which is called every loop as long as it does not return true
// - create the game object: new Game(options)
//   valid options (with default):
//   - width (800)
//   - height (600) 
//   - frame_cap (30; may run faster, this just limits the reported dt)
//   - is3d (false)

function Game(options){
	//handle options
	var is3d = false;
	this.width = 800; this.height = 600;
	this.dt_max = 1/30;
	if (options){
		if (options.width) this.width = options.width;
		if (options.height) this.height = options.height;
		if (options.frame_cap) this.dt_max = 1/options.frame_cap;
		if (options.is3d) is3d = options.is3d;
	}
	
	//create canvas and drawing context
	this.canvas = document.getElementById("game-window");
	this.canvas.width = this.width; this.canvas.height = this.height;
	if (is3d){
		//create a second canvas for 2d drawing
		this.canvas2d = document.createElement("canvas");
		this.canvas2d.id = "game-overlay";
		this.canvas2d.style.position = "absolute";
		this.canvas2d.style.left = "0px"; this.canvas2d.style.top = "0px";
		this.canvas2d.width = this.width; this.canvas2d.height = this.height;
		this.canvas.style.zIndex = 1; this.canvas2d.style.zIndex = 2;
		this.canvas2d.style.background = "transparent";
		this.canvas.parentNode.appendChild(this.canvas2d);
		this.ctx = this.canvas2d.getContext("2d");
	}else{
		this.ctx = this.canvas.getContext("2d");
		this.ctx.fillStyle = "#000000";
		this.ctx.fillRect(0, 0, this.width, this.height);
		//make it pixellated
		if (typeof this.ctx.imageSmoothingEnabled === "boolean"){
			this.ctx.imageSmoothingEnabled = false;
		}else{
			this.ctx.mozImageSmoothingEnabled = false;
			this.ctx.webkitImageSmoothingEnabled = false;
			this.ctx.msImageSmoothingEnabled = false;
		}
	}
	
	this.loading_progress = 0;
	this._anim_ref = null;
	this._update_cb = this._update.bind(this);
	if (this.init) this.init();
	this.run();
}

Game.prototype.run = function(){
	if (this.loading_progress > 0){
		this.loading_progress -= 1;
	}else{
		if (this._anim_ref === null && this.update)
			this._anim_ref = window.requestAnimationFrame(this._update_cb);
	}
}

Game.prototype._update = function(now){
	if (!this.now)
		this.now = now;
	var dt = Math.min((now - this.now)/1000, this.dt_max);
	this.now = now;
	if (this.update(dt))	//update should return true for 'done'
		this._anim_ref = null;
	else
		this._anim_ref = window.requestAnimationFrame(this._update_cb);
}
