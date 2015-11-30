/***********************************************************
 *
 * ARM.Simulator.Memory.js
 *	Author:	 Torben Könke
 *	Date:    09.06.2012
 *
 * Implements a simple ARM CPU simulator which simulates
 *	the ARMv4T instruction architecture.
 *
 **********************************************************/

var ARM = ARM || {Simulator:{}};

ARM.Simulator.Memory = function(O) {
	function Memory(O) {
		if(!O)
			throw new Error('No memory regions provided');
		for(var i in O) {
			var R = {
				Base:	O[i].Base,
				Size:	O[i].Size,
				Read:	O[i].Read,
				Write:	O[i].Write,
			  Context:	O.Context || null
			};
			if(!R.Read && !R.Write) {
				R.Data	= new ArrayBuffer(R.Size);
				R.U8	= new Uint8Array(R.Data);
				R.U16	= new Uint16Array(R.Data);
				R.U32	= new Uint32Array(R.Data);
			}
			this.Regions.push(R);
		}
	}

	this.Map = function(O) {
		var F = ['Base', 'Size', 'Read', 'Write'];
		for(var i in F) {
			if(typeof O[F[i]] == 'undefined')
				throw new Error('Invalid parameters');
		}
		this.Regions.push({
			Base:		O.Base,
			Size:		O.Size,
			Read:		O.Read,
			Write:		O.Write,
			Context:	O.Context || null
		});
	},

	this.Unmap = function(Base) {
		for(var i in this.Regions) {
			var R = this.Regions[i];
			if(R.Base == Base) {
				this.Regions.splice(i, 1);
				return;
			}
		}
		throw new Error('Region not found');
	},

	/* javascript's typed arrays' endianness is that of the underlying hardware :(
		http://stackoverflow.com/questions/7869752/javascript-typed-arrays-and-endianness?rq=1
	*/
	this.Read = function(Address, Type) {
		var T = {'BYTE':1, 'HWORD':2, 'WORD':4, '2BYTE':2, '4BYTE':4};
		Type = Type.toUpperCase();
		for(var i in this.Regions) {
			var R = this.Regions[i];
			if(Address < R.Base || Address >= (R.Base + R.Size))
				continue;
			if(R.Read)
				return R.Read.call(R.Context || this, Address, Type);
			/* read data from address */
			if(!T[Type])
				throw new Error('Invalid data type');
			var Offset = Address - R.Base;
			if(Offset % T[Type])
				throw new Error('Misaligned memory address (0x' +
					Address.toString(16) + ')');
			return R['U' + (T[Type] * 8)][ Offset / T[Type] ];

		}
		throw new ARM.Simulator.Memory.BadAddressException('Bad memory ' +
			'access: Unmapped memory region (0x' + Address.toString(16) + ')');
	}

	this.Write = function(Address, Type, Value) {
/*		console.info('Write at Address 0x' + Address.toString(16) +
			' (' + Address + ') Value 0x' + Value.toString(16) + ' (' + Value + ')');
*/
		var T = {'BYTE':1, 'HWORD':2, 'WORD':4, '2BYTE':2, '4BYTE':4};
		Type = Type.toUpperCase();
		for(var i in this.Regions) {
			var R = this.Regions[i];
			if(Address < R.Base || Address >= (R.Base + R.Size))
				continue;
			if(R.Write)
				return R.Write.call(R.Context || this, Address, Type, Value);
			/* write data to address */
			if(!T[Type])
				throw new Error('Invalid data type');
			var Offset = Address - R.Base;
			if(Offset % T[Type])
				throw new Error('Misaligned memory address (0x' +
					Address.toString(16) + ')');
			var Index = Offset / T[Type];
			R['U' + (T[Type] * 8)][ Index ] = Value;
			return;
		}
		throw new ARM.Simulator.Memory.BadAddressException('Bad memory ' +
			'access: Unmapped memory region (0x' + Address.toString(16) + ')');
	}

	this.Regions = [],

	Memory.call(this, O);
};

/*
 * ARM.Simulator.Memory.BadAddressException
 *
 *	An exception of this type is thrown by Memory.Read or
 *	Memory.Write if an attempt is made to read or write an
 *	illegal (unmapped) memory address.
 */
ARM.Simulator.Memory.BadAddressException = function(S) {
	this.name = "BadMemoryAddressException";
	this.message = S || 'Illegal memory address referenced';
}

ARM.Simulator.Memory.BadAddressException.prototype = new Error();
ARM.Simulator.Memory.BadAddressException.prototype.constructor =
	ARM.Simulator.Memory.BadAddressException;

