//-------- extra objects

function Room(contents){
	this.canvas = document.createElement("canvas");
	this.height = contents.tiles.length;
	this.width = contents.tiles[0].length;
	this.tile_size = 16;
	this.canvas.width = this.width*this.tile_size;
	this.canvas.height = this.height*this.tile_size;
	this.ctx = this.canvas.getContext("2d");
	this.x = 0;
	this.y = 0;
	
	var x, y, type, obj;
	this.occupied = new Array(this.width);
	this.floor = new Array(this.width);
	this.buttons = contents.buttons;
	this.boulders = [];
	this.player = null;
	for (x = 0; x < this.width; x++){
		this.occupied[x] = new Array(this.height);
		this.floor[x] = new Array(this.height);
		for (y = 0; y < this.height; y++){
			type = contents.tiles[y].charAt(x);
			this.set_floor(type, x, y);
			if (type === "^"){	//player
				obj = new Actor(x, y);
				this.occupied[x][y] = obj;
				this.player = obj;
			}else if (type === "*"){	//boulder
				obj = new Actor(x, y);
				this.occupied[x][y] = obj;
				this.boulders.push(obj);
			}
		}
	}
}

Room.prototype.draw = function(ctx){
	var i, x, y, obj;
	ctx.drawImage(this.canvas, this.x, this.y);
	ctx.fillStyle = "#bf6000";
	for (i = 0; i < this.boulders.length; i++){
		obj = this.boulders[i];
		x = Math.floor(this.x + obj.grid_x*this.tile_size + obj.x_off);
		y = Math.floor(this.y + obj.grid_y*this.tile_size + obj.y_off);
		ctx.beginPath();
		ctx.rect(x, y, this.tile_size, this.tile_size);
		ctx.fill();
	}
	obj = this.player;
	x = Math.floor(this.x + obj.grid_x*this.tile_size + obj.x_off);
	y = Math.floor(this.y + obj.grid_y*this.tile_size + obj.y_off);
	ctx.fillStyle = "#0080ff";
	ctx.beginPath();
	ctx.rect(x, y, this.tile_size, this.tile_size);
	ctx.fill();
}

Room.prototype.object_at = function(x, y){
	if (x < 0 || y < 0 || x >= this.width || y >= this.height)
		return true;
	return this.occupied[x][y];
}

Room.prototype.set_floor = function(type, x, y){
	var ctx = this.ctx;
	ctx.fillStyle = "#ffffff";
	this.occupied[x][y] = false;
	if (type === "@"){	//exit
		ctx.fillStyle = "#00bf00";
	}else if (type === "#"){	//wall
		ctx.fillStyle = "#000000";
		this.occupied[x][y] = true;
	}else if (type === "~"){	//ice
		ctx.fillStyle = "#00ffff";
	}else if (type.match(/[0-9]/)){	//button
		ctx.fillStyle = "#8000ff";
	}else{
		type = " ";
	}
	this.floor[x][y] = type;
	ctx.beginPath();
	ctx.rect(x*this.tile_size, y*this.tile_size, this.tile_size, this.tile_size);
	ctx.fill();
}

Room.prototype.move_to = function(obj, x, y){
	var old_x = obj.grid_x, old_y = obj.grid_y, type, button;
	//move
	obj.grid_x = x; obj.grid_y = y;
	obj.x_off = 0; obj.y_off = 0;
	this.occupied[x][y] = obj;
	//check the terrain
	type = this.floor[x][y];
	if (type !== "~" || this.object_at(x+obj.dx, y+obj.dy)){	//not on ice
		obj.dx = 0; obj.dy = 0; obj.moving = false;
		if (type.match(/[0-9]/)){
			button = this.buttons[parseInt(type)];
			this.set_floor(button.on, button.target.x, button.target.y);
		}
	}
	//look very carefully at where it used to be
	obj = this.object_at(old_x, old_y);
	if (!!obj && obj !== true){	//should always happen, but best be safe
		//coordinates not matching means it was the thing we just moved (so delete that reference)
		//if they do match, it was something else, and is supposed to be there
		if (obj.grid_x !== old_x || obj.grid_y !== old_y){
			this.occupied[old_x][old_y] = false;
			//release button if necessary
			type = this.floor[old_x][old_y];
			if (type.match(/[0-9]/)){
				button = this.buttons[parseInt(type)];
				this.set_floor(button.off, button.target.x, button.target.y);
			}
		}
	}
}

function Actor(x, y){
	this.grid_x = x; this.grid_y = y;
	this.x_off = 0; this.y_off = 0;
	this.spd = 80;
	this.dx = 0; this.dy = 0; this.moving = false;
}

//-------- game object

Game.prototype.init = function(){
	this.resource = new Resource(this);
	this.loading_progress += 1;
	this.resource.load_data(["levels"], this.run.bind(this));
	this.scene = 0;
	
	document.addEventListener("keydown", this.handle_keyhit.bind(this), false);
	document.addEventListener("keyup", this.handle_keyup.bind(this), false);
	this.canvas.addEventListener("blur", function(){this.paused = true}.bind(this), true);
	this.canvas.addEventListener("focus", function(){
		if (this.paused === true){
			this.paused = false;
			this.run();
		}
	}.bind(this), true);
	this.canvas.focus();
}

Game.prototype.reset = function(){
	this.room = new Room(this.resource.data.levels[this.level])
	this.room.x = (this.width - (this.room.width*this.room.tile_size))/2;
	this.room.y = (this.height - (this.room.height*this.room.tile_size))/2;
	this.player = this.room.player;
	this.player.events = new EventList();
	this.moving = [];
}

//-------- input

Game.prototype.handle_keyhit = function(e){
	var key = e.which || e.keyCode, handled = true;
	switch (key){
	case 32:	//space
		if (this.scene === 1){
			this.reset();
			this.run();
		}else if (this.scene === 2){
			this.level += 1;
			if (this.level < this.resource.data.levels.length){
				this.scene = 1;
				this.reset();
			}else{
				this.scene = 3;
			}
			this.run()
		}
		break;
	case 37: case 65:	//left / A
		if (this.scene === 1){	//playing
			this.player.events.push("move-left");
		}
		break;
	case 38: case 87:	//up / W
		if (this.scene === 1){	//playing
			this.player.events.push("move-up");
		}
		break;
	case 39: case 68:	//right / D
		if (this.scene === 1){	//playing
			this.player.events.push("move-right");
		}
		break;
	case 40: case 83:	//down / S
		if (this.scene === 1){	//playing
			this.player.events.push("move-down");
		}
		break;
	default:
		// console.log(key);
		handled = false;
	}
	if (handled === true){
		e.preventDefault(); e.stopPropagation();
	}
}

Game.prototype.handle_keyup = function(e){
	var key = e.which || e.keyCode;
	switch (key){
	case 37: case 65:	//left / A
		if (this.scene === 1){	//playing
			this.player.events.eradicate("move-left");
		}
		break;
	case 38: case 87:	//up / W
		if (this.scene === 1){	//playing
			this.player.events.eradicate("move-up");
		}
		break;
	case 39: case 68:	//right / D
		if (this.scene === 1){	//playing
			this.player.events.eradicate("move-right");
		}
		break;
	case 40: case 83:	//down / S
		if (this.scene === 1){	//playing
			this.player.events.eradicate("move-down");
		}
		break;
	}
}

//-------- update

Game.prototype.update = function(dt){
	var done = false;
	
	//handle un/pausing
	if (this.paused){
		done = true;
	}
	// console.log(this.scene);
	if (this.scene === 0){	//would be a title screen if I had time
		this.level = 0;
		this.scene = 1;
		this.reset();
	}else if (this.scene === 1){	//playing
		var room = this.room, player = this.player, l = player.events.length, moving = player.moving, dx = 0, dy = 0, obj, checkwin = false;
		if (l > 0){	//has events to handle
			for (i = l-1; i >= 0; i--){
				switch (player.events[i]){
				case "move-left":
					if (!moving){
						dx = -1;
						dy = 0
						moving = true;
					}
					break;
				case "move-right":
					if (!moving){
						dx = 1;
						dy = 0;
						moving = true;
					}
					break;
				case "move-up":
					if (!moving){
						dx = 0;
						dy = -1;
						moving = true;
					}
					break;
				case "move-down":
					if (!moving){
						dx = 0;
						dy = 1;
						moving = true;
					}
					break;
				}
			}
		}
		if (moving && !player.moving){	//must be a new movement - check for collisions
			var target_x = player.grid_x + dx, target_y = player.grid_y + dy;
			obj = room.object_at(target_x, target_y);
			if (obj === true){	//wall
				moving = false;
			}else if (obj){	//boulder
				if (room.object_at(target_x + dx, target_y + dy)){	//blocked
					moving = false;
				}else{
					//commence pushing
					obj.dx = dx;
					obj.dy = dy;
					obj.moving = true;
					this.moving.push(obj);
				}
			}
			if (moving){
				player.dx = dx;
				player.dy = dy;
				player.moving = true;
				this.moving.push(player);
			}
		}
		for (i = this.moving.length-1; i >= 0; i--){
			obj = this.moving[i];
			obj.x_off += obj.spd * obj.dx * dt;
			obj.y_off += obj.spd * obj.dy * dt;
			if (Math.abs(obj.x_off) >= room.tile_size || Math.abs(obj.y_off) >= room.tile_size){
				room.move_to(obj, obj.grid_x + obj.dx, obj.grid_y + obj.dy);
			}
			if (!obj.moving){
				this.moving.splice(i, 1);
				checkwin = true;
			}
		}
		if (checkwin){
			if (room.floor[player.grid_x][player.grid_y] === "@"){
				this.scene = 2;
				done = true;
			}
		}
	}else{
		done = true;
	}
	
	this.render();
	return done;
}

Game.prototype.render = function(){
	var ctx = this.ctx;
	ctx.fillStyle = "#404040";
	ctx.fillRect(0, 0, this.width, this.height);
	
	if (this.scene === 0){	//title screen
	}else if (this.scene < 3){	//not won yet
		this.room.draw(ctx);
		if (this.scene === 2){	//level complete
			ctx.textAlign = "center";
			ctx.fillStyle = "#ffffff";
			ctx.font = "Bold 40pt Courier";
			ctx.fillText("Level complete!", this.width/2, 80);
			ctx.font = "Bold 24pt Courier";
			ctx.fillText("Press [space] to continue", this.width/2, 128);
		}
	}else if (this.scene === 3){	//game complete
		ctx.textAlign = "center";
		ctx.fillStyle = "#ffffff";
		ctx.font = "Bold 40pt Courier";
		ctx.fillText("Thanks for playing!", this.width/2, this.height/2);
		ctx.font = "Bold 20pt Courier";
		ctx.fillText("That's all for now", this.width/2, this.height/2-48);
	}
	
	//pause
	if (this.scene === 1 && this.paused === true){
		ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.textAlign = "center";
		ctx.fillStyle = "#ffffff";
		ctx.font = "Bold 40pt Courier";
		ctx.fillText("Paused...", this.width/2, this.height/2);
	}
}

//--------

window.onload = function(){
	game = new Game();
}
