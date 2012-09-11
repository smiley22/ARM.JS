/***********************************************************
 *
 * ARM.Simulator.Loader.BinaryReader.js
 *	Author:	 Torben Könke
 *	Date:    16.07.2012
 *
 * A simple 'class' for reading binary data from a byte
 * array.
 *
 **********************************************************/

var ARM = ARM || {Simulator:{Loader:{}}};

ARM.Simulator.Loader.BinaryReader = function(D, O) {

	function BinaryReader(D, O) {
		this.Data = D;
		if(O) {
			if(O.BigEndian == true)
				this.BigEndian = true;
		}
	}

	this.BigEndian	= false;
	this.Pos		= 0;

	this.ReadUint32 = function() {
		if((this.Pos + 3) >= this.Data.length)
			throw new Error('EOFException');
		var val = 0;
		for(var i = 0; i < 4; i++)
			val = val + ((this.Data[ this.Pos++ ] << (8 * i)) >>> 0);
		return val;
	}

	this.ReadUint16 = function() {
		if((this.Pos + 1) >= this.Data.length)
			throw new Error('EOFException');
		var val = 0;
		for(var i = 0; i < 2; i++)
			val = val + ((this.Data[ this.Pos++ ] << (8 * i)) >>> 0);
		return val;
	}

	this.ReadUint8 = function() {
		if(this.Pos >= this.Data.length)
			throw new Error('EOFException');
		return this.Data[this.Pos++];
	}

	this.ReadInt32 = function() {
		if((this.Pos + 3) >= this.Data.length)
			throw new Error('EOFException');
		var val = 0;
		for(var i = 0; i < 4; i++)
			val = val | (this.Data[ this.Pos++ ] << (8 * i))
		return val;
	}

	this.ReadInt16 = function() {
		if((this.Pos + 1) >= this.Data.length)
			throw new Error('EOFException');
		var val = 0;
		for(var i = 0; i < 2; i++)
			val = val + (this.Data[ this.Pos++ ] << (8 * i));
		return this.SignExtend(val, 16, 32);
	}
	
	this.ReadInt8 = function() {
		if(this.Pos >= this.Data.length)
			throw new Error('EOFException');
		return this.SignExtend(this.Data[this.Pos++], 8, 32);
	}

	this.ReadBytes = function(N) {
		var R = [];
		for(var i = 0; i < N; i++)
			R.push(this.ReadUint8());
		return R;
	}

	this.Seek = function(S) {
		if(S < 0 || S >= this.Data.length)
			throw new Error('EOFException');
		this.Pos = S;
	}

	this.ReadStruct = function(S) {
		var T = {
			'u8':	[1,'Uint8'],	's8':	[1,'Int8'], 
			'u16':	[2,'Uint16'],	's16':	[2,'Int16'],
			'u32':	[4,'Uint32'],	's32':	[4,'Int32']
		};
		var R = {};
		for(var e in S) {
			var Field	= S[e][0];
			var Size	= S[e][1];
			var Type	= S[e][2].toLowerCase();
			if(Size > T[Type][0]) {
				if(Size % T[Type][0]) {
					throw new Error('size not a multiple of data type ' +
						'size for ' + Field);
				}
				R[Field] = [];
				for(var i = 0; i < (Size / T[Type][0]); i++)
					R[Field].push(this['Read' + T[Type][1]]());
			} else if(Size == T[Type][0])
				R[Field] = this['Read' + T[Type][1]]();
			else
				throw new Error('illegal size for data type ' + Field);
		}
		return R;
	}

	this.SignExtend = function(V, F, T) {
		var msb = F - 1;
		if(V & (1 << msb)) {
			for(var i = 1 + msb; i < T; i++)
				V |= (1 << i);
		}
		return V;
	}

	BinaryReader.call(this, D, O);
}
