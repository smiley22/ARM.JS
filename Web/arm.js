var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ARM;
(function (ARM) {
    var Assembler;
    (function (Assembler) {
        var Util = (function () {
            function Util() {
            }
            Util.StripComments = function (text) {
                var str = ("__" + text + "__").split('');
                var mode = {
                    singleQuote: false, doubleQuote: false,
                    blockComment: false, lineComment: false
                };
                for (var i = 0, l = str.length; i < l; i++) {
                    if (mode.singleQuote) {
                        if (str[i] === "'" && str[i - 1] !== '\\')
                            mode.singleQuote = false;
                        continue;
                    }
                    if (mode.doubleQuote) {
                        if (str[i] === '"' && str[i - 1] !== '\\')
                            mode.doubleQuote = false;
                        continue;
                    }
                    if (mode.blockComment) {
                        if (str[i] === '*' && str[i + 1] === '/') {
                            str[i + 1] = '';
                            mode.blockComment = false;
                        }
                        str[i] = '';
                        continue;
                    }
                    if (mode.lineComment) {
                        if (str[i + 1] === '\n' || str[i + 1] === '\r')
                            mode.lineComment = false;
                        else if (str[i] === '\n' || str[i] === '\r')
                            mode.lineComment = false;
                        str[i] = '';
                        continue;
                    }
                    mode.doubleQuote = str[i] === '"';
                    mode.singleQuote = str[i] === "'";
                    if (str[i] === '/') {
                        if (str[i + 1] === '*') {
                            str[i] = '';
                            mode.blockComment = true;
                            continue;
                        }
                    }
                    else if (str[i] === '@' || str[i] === ';') {
                        str[i] = '';
                        mode.lineComment = true;
                        continue;
                    }
                    else if (str[i] === '#') {
                        var empty = true;
                        for (var c = i - 1; c >= 2; c--) {
                            if (str[c] == '\n')
                                break;
                            if (str[c] != '' && str[c] != ' ' && str[c] != '\t') {
                                empty = false;
                                break;
                            }
                        }
                        if (empty) {
                            str[i] = '';
                            mode.lineComment = true;
                            continue;
                        }
                    }
                }
                return str.join('').slice(2, -2);
            };
            Util.MergeObjects = function (a, b) {
                var ret = {};
                for (var i in a)
                    ret[i] = a[i];
                for (var i in b)
                    ret[i] = b[i];
                return ret;
            };
            Util.IsRegister = function (op) {
                if (typeof (op) != 'string' || op.length < 2)
                    return false;
                return op[0] == 'R';
            };
            Util.EncodeImmediate = function (value) {
                function rotateRight(v, n) {
                    for (var i = 0; i < n; i++)
                        v = (v >>> 1) | ((v & 0x01) << 31);
                    return v;
                }
                var m = ((value >>> 31) & 0x01) ? true : false;
                if (m)
                    value = ~value;
                var l = null;
                for (var i = 0; i < 16; i++) {
                    value = rotateRight(value, 2);
                    if (value >= 0 && value < 256)
                        l = { Immediate: value, Rotate: (15 - i), Negative: m };
                }
                if (l == null)
                    throw new Error("Invalid constant 0x" + Math.abs(value).toString(16));
                return l;
            };
            return Util;
        }());
        Assembler.Util = Util;
    })(Assembler = ARM.Assembler || (ARM.Assembler = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Assembler;
    (function (Assembler) {
        var Litpool = (function () {
            function Litpool(section, base, size) {
                this.literals = {};
                this.size = 0;
                this.base = 0;
                this.position = 0;
                this.size = size || Litpool.DefaultSize;
                this.base = base;
                this.section = section;
                this.section.Grow(this.size);
            }
            Object.defineProperty(Litpool.prototype, "Base", {
                get: function () {
                    return this.base;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Litpool.prototype, "Size", {
                get: function () {
                    return this.size;
                },
                enumerable: true,
                configurable: true
            });
            Litpool.prototype.Put = function (value) {
                if (this.literals[value])
                    return this.literals[value];
                if (this.position >= this.size)
                    throw new Error('Literal pool overflow.');
                var offset = this.base + this.position, view = new Uint32Array(this.section.Buffer), index = offset / 4;
                view[index] = value;
                this.literals[value] = offset;
                this.position = this.position + 4;
                return offset;
            };
            Litpool.DefaultSize = 0x1000;
            return Litpool;
        }());
        Assembler.Litpool = Litpool;
    })(Assembler = ARM.Assembler || (ARM.Assembler = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Assembler;
    (function (Assembler) {
        var Parser = (function () {
            function Parser(symbolLookup, sectionPos) {
                this.symbolLookup = symbolLookup;
                this.sectionPos = sectionPos;
            }
            Parser.ParseMnemonic = function (s) {
                var ret = {}, matched = false;
                s = s.replace(/\t/g, ' ').trim();
                var T = s.split(' ');
                for (var i = 0; i < T[0].length; i++, ret = {}) {
                    var mnemonic = T[0].substr(0, i + 1).toUpperCase();
                    if (this.mnemonics.indexOf(mnemonic) < 0)
                        continue;
                    ret['Mnemonic'] = mnemonic;
                    var d = T[0].substr(i + 1), cond = d.substr(0, 2).toUpperCase();
                    if (this.conditions.indexOf(cond) >= 0) {
                        ret['Condition'] = cond;
                        d = d.substr(cond.length);
                    }
                    if (d == '') {
                        matched = true;
                        break;
                    }
                    var sl = this.suffixes[mnemonic];
                    if (!sl)
                        continue;
                    for (var c = 0; c < sl.length; c++) {
                        var re = new RegExp("^(" + sl[c].Suffix + ")" + (sl[c].Required ? '' : '?'), 'i');
                        if (!re.exec(d) || RegExp.$1 == '')
                            continue;
                        ret[sl[c].Name ? sl[c].Name : sl[c].Suffix] = RegExp.$1.toUpperCase();
                        d = d.substr(RegExp.$1.length);
                    }
                    if (d == '') {
                        matched = true;
                        break;
                    }
                }
                if (!matched)
                    throw new SyntaxError("Invalid mnemonic " + s);
                return [ret, s.substr(s.indexOf(' ')).trim()];
            };
            Parser.ParseRegister = function (s) {
                var n = { 'FP': 'R11', 'SP': 'R13', 'LR': 'R14', 'PC': 'R15' };
                s = s.trim().toUpperCase();
                if (s.length == 2) {
                    if (s[0] == 'R' && !isNaN(parseInt(s[1])))
                        return s;
                    if (n[s])
                        return n[s];
                }
                else if (s.length == 3) {
                    if (s[0] == 'R' && s[1] == '1' && parseInt(s[2]) < 6)
                        return s;
                }
                throw new SyntaxError("Unexpected ARM register identifier '" + s + "'");
            };
            Parser.ParseCPRegister = function (s) {
                s = s.trim().toUpperCase();
                if (s.length == 2) {
                    if (s[0] == 'C' && !isNaN(parseInt(s[1])))
                        return s;
                }
                else if (s.length == 3) {
                    if (s[0] == 'C' && s[1] == '1' && parseInt(s[2]) < 6)
                        return s;
                }
                throw new SyntaxError("Expected co-processor register identifier '" + s + "'");
            };
            Parser.prototype.ParseExpression = function (s) {
                if (s[0] == '#')
                    s = s.substr(1);
                try {
                    var t = parseInt(eval(s));
                    if (!isNaN(t))
                        return t;
                }
                catch (e) {
                    var m = s.match(/[A-Za-z_]\w+/g);
                    for (var _i = 0, m_1 = m; _i < m_1.length; _i++) {
                        var i = m_1[_i];
                        s = s.replace(new RegExp(i, 'g'), this.symbolLookup(i));
                    }
                    try {
                        var t = parseInt(eval(s));
                        if (isNaN(t))
                            throw new Error("Invalid expression '" + s + "'");
                        return t;
                    }
                    catch (e) {
                        throw new Error("Unresolved symbol '" + s + "'");
                    }
                }
            };
            Parser.prototype.ParseAddress = function (s) {
                var ret;
                s = s.trim();
                if (s[0] == '=') {
                    return {
                        Type: 'Imm',
                        Offset: this.ParseExpression(s.substr(1)),
                        Pseudo: true
                    };
                }
                if (s.match(/^\[\s*(\w+)\s*,\s*(.*)\](!)?$/i)) {
                    ret = {
                        Type: 'Pre',
                        Source: Parser.ParseRegister(RegExp.$1),
                        Writeback: RegExp.$3 ? true : false
                    };
                    var tmp = RegExp.$2.trim();
                    try {
                        ret['Offset'] = this.ParseExpression(tmp);
                        ret['Immediate'] = true;
                    }
                    catch (e) {
                        var m = tmp.match(/^([+|-])?\s*(\w+)(\s*,\s*(ASL|LSL|LSR|ASR|ROR)\s*(.*))?$/i);
                        if (!m)
                            throw new Error("Invalid address expression " + s);
                        ret['Subtract'] = m[1] == '-';
                        ret['Offset'] = Parser.ParseRegister(m[2]);
                        if (m[3]) {
                            ret['ShiftOp'] = m[4].toUpperCase();
                            var t = this.ParseExpression(m[5]);
                            if (t > 31)
                                throw new Error("Shift expression too large " + t);
                            ret['Shift'] = t;
                        }
                    }
                }
                else if (s.match(/^\[\s*(\w+)\s*\]\s*(,(.*))?$/i)) {
                    ret = {
                        Type: 'Post',
                        Source: Parser.ParseRegister(RegExp.$1)
                    };
                    if (!RegExp.$2)
                        return ret;
                    var tmp = RegExp.$3.trim();
                    try {
                        ret['Offset'] = this.ParseExpression(tmp);
                        ret['Immediate'] = true;
                    }
                    catch (e) {
                        var m = tmp.match(/^([+|-])?\s*(\w+)(\s*,\s*(ASL|LSL|LSR|ASR|ROR)\s*(.*))?$/i);
                        ret['Subtract'] = m[1] == '-';
                        ret['Offset'] = Parser.ParseRegister(m[2]);
                        if (m[3]) {
                            ret['ShiftOp'] = m[4].toUpperCase();
                            var t = this.ParseExpression(m[5]);
                            if (t > 31)
                                throw new Error("Shift expression too large " + t);
                            ret['Shift'] = t;
                        }
                    }
                }
                else {
                    var addr = this.symbolLookup(s);
                    if (addr) {
                        var dist = addr - this.sectionPos();
                        return {
                            Type: 'Pre',
                            Source: 'R15',
                            Immediate: true,
                            Offset: dist
                        };
                    }
                    else
                        throw new SyntaxError("Invalid address expression " + s);
                }
                return ret;
            };
            Parser.prototype.ParseOperands = function (mnemonic, operands) {
                var lookup = [
                    [['BX'], 0],
                    [['BL', 'B', 'SWI'], 1],
                    [['AND', 'EOR', 'SUB', 'RSB', 'ADD', 'ADC',
                            'SBC', 'RSC', 'ORR', 'BIC'], 2],
                    [['MRS'], 3],
                    [['MSR'], 4],
                    [['MUL'], 5],
                    [['MLA'], 6],
                    [['UMULL', 'UMLAL', 'SMULL', 'SMLAL'], 7],
                    [['LDR', 'STR'], 8],
                    [['LDM', 'STM'], 9],
                    [['SWP'], 10],
                    [['CDP'], 11],
                    [['LDC', 'STC'], 12],
                    [['MCR', 'MRC'], 13],
                    [['MOV', 'MVN'], 14],
                    [['NOP'], 15],
                    [['PUSH', 'POP'], 16],
                    [['LSL', 'LSR', 'ASR', 'ROR'], 17],
                    [['RRX'], 18],
                    [['CMP', 'CMN', 'TEQ', 'TST'], 19]
                ];
                for (var _i = 0, lookup_1 = lookup; _i < lookup_1.length; _i++) {
                    var entry = lookup_1[_i];
                    if (entry[0].indexOf(mnemonic.toUpperCase()) >= 0)
                        return this[("ParseOperands_" + entry[1])](operands);
                }
                throw new SyntaxError("Invalid Mnemonic " + mnemonic);
            };
            Parser.prototype.ParseOperands_0 = function (s) {
                return {
                    Rn: Parser.ParseRegister(s)
                };
            };
            Parser.prototype.ParseOperands_1 = function (s) {
                var t = this.ParseExpression(s);
                if (t % 4)
                    throw new SyntaxError("Misaligned branch destination " + t);
                if (t < -33554432 || t > 33554431)
                    throw new RangeError("Branch destination " + t + " is out of range");
                return {
                    Offset: t
                };
            };
            Parser.prototype.ParseOperands_2 = function (s) {
                var r = {}, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length == 1)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                r['Rd'] = Parser.ParseRegister(a[0]);
                var isImm = false;
                try {
                    r['Rn'] = Parser.ParseRegister(a[1]);
                }
                catch (e) {
                    r['Rn'] = this.ParseExpression(a[1]);
                    isImm = true;
                }
                if (isImm && a.length > 2)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                if (a.length == 2) {
                    if (isImm) {
                        r['Op2'] = Assembler.Util.EncodeImmediate(r['Rn']);
                        r['Immediate'] = true;
                    }
                    else
                        r['Op2'] = r['Rn'];
                    r['Rn'] = r['Rd'];
                    return r;
                }
                try {
                    r['Op2'] = Parser.ParseRegister(a[2]);
                }
                catch (e) {
                    var t = this.ParseExpression(a[2]);
                    var enc = Assembler.Util.EncodeImmediate(t);
                    r['Immediate'] = true;
                    r['Op2'] = enc;
                }
                if (a.length == 3)
                    return r;
                if (r['Immediate']) {
                    if (r['Op2'].Rotate > 0)
                        throw new Error('Illegal shift on rotated value');
                    var t = this.ParseExpression(a[3]);
                    if ((t % 2) || t < 0 || t > 30)
                        throw new Error("Invalid rotation: " + t);
                    r['Op2'].Rotate = t / 2;
                }
                else {
                    if (a[3].match(/^(ASL|LSL|LSR|ASR|ROR)\s*(.*)$/i)) {
                        r['ShiftOp'] = RegExp.$1;
                        var f = RegExp.$2;
                        try {
                            r['Shift'] = Parser.ParseRegister(f);
                        }
                        catch (e) {
                            var t = this.ParseExpression(f);
                            if (t > 31)
                                throw new RangeError('Shift value out of range');
                            r['Shift'] = t;
                        }
                    }
                    else if (a[3].match(/^RRX$/i))
                        r['Rrx'] = true;
                    else
                        throw new SyntaxError("Invalid expression " + a[3]);
                }
                if (a.length > 4)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                return r;
            };
            Parser.prototype.ParseOperands_3 = function (s) {
                var r = { Rd: '', P: '' }, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length == 1)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                r.Rd = Parser.ParseRegister(a[0]);
                if (r.Rd == 'R15')
                    throw new Error('R15 is not allowed as destination register');
                if (!a[1].match(/^(CPSR|CPSR_all|SPSR|SPSR_all)$/i))
                    throw new SyntaxError("Constant identifier expected for " + a[1]);
                r.P = RegExp.$1.toUpperCase();
                return r;
            };
            Parser.prototype.ParseOperands_4 = function (s) {
                var r = { P: '', Op2: 0 }, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length == 1)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                if (!a[0].match(/^(CPSR|CPSR_all|SPSR|SPSR_all|CPSR_flg|SPSR_flg)$/i))
                    throw new SyntaxError("Constant identifier expected for " + a[0]);
                r['P'] = RegExp.$1.toUpperCase();
                var imm = r['P'].match(/_flg/i) != null;
                try {
                    r['Op2'] = Parser.ParseRegister(a[1]);
                    if (r['Op2'] == 'R15')
                        throw new Error('R15 is not allowed as source register');
                }
                catch (e) {
                    if (!imm)
                        throw e;
                    var t = this.ParseExpression(a[1]), l = 0;
                    for (var i = 31; i >= 0; i--) {
                        if (!l && ((t >>> i) & 0x1))
                            l = i;
                        if ((l - i) > 8 && ((t >>> i) & 0x1))
                            throw new Error("Invalid constant (" + t.toString(16) + ") after fixup");
                    }
                    r['Op2'] = this.ParseExpression(a[1]);
                }
                return r;
            };
            Parser.prototype.ParseOperands_5 = function (s) {
                var r = {}, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length != 3)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                for (var i = 1; i < 4; i++) {
                    r[("Op" + i)] = Parser.ParseRegister(a[i - 1]);
                    if (r[("Op" + i)] == 'R15')
                        throw new Error('R15 must not be used as operand');
                }
                if (r['Op1'] == r['Op2'])
                    throw new Error('Destination register must not be the same as operand');
                return r;
            };
            Parser.prototype.ParseOperands_6 = function (s) {
                var r = {}, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length != 4)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                for (var i = 1; i < 5; i++) {
                    r[("Op" + i)] = Parser.ParseRegister(a[i - 1]);
                    if (r[("Op" + i)] == 'R15')
                        throw new Error('R15 must not be used as operand');
                }
                if (r['Op1'] == r['Op2'])
                    throw new Error('Destination register must not be the same as operand');
                return r;
            };
            Parser.prototype.ParseOperands_7 = function (s) {
                var r = {}, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length != 4)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                var e = {};
                for (var i = 1; i < 5; i++) {
                    r[("Op" + i)] = Parser.ParseRegister(a[i - 1]);
                    if (r[("Op" + i)] == 'R15')
                        throw new Error('R15 must not be used as operand');
                    if (e[r[("Op" + i)]])
                        throw new Error('Operands must specify different registers');
                    e[r[("Op" + i)]] = true;
                }
                return r;
            };
            Parser.prototype.ParseOperands_8 = function (s) {
                var r = {};
                s = s.trim();
                if (!s.match(/^(\w+)\s*,\s*(.*)$/i))
                    throw new SyntaxError("Invalid instruction syntax " + s);
                r['Rd'] = Parser.ParseRegister(RegExp.$1);
                return Assembler.Util.MergeObjects(r, this.ParseAddress(RegExp.$2));
            };
            Parser.prototype.ParseOperands_9 = function (s) {
                var r = {};
                s = s.trim();
                if (!s.match(/^(\w+)\s*(!)?\s*,\s*{(.*)}\s*(\^)?$/i))
                    throw new SyntaxError("Invalid instruction syntax " + s);
                r['Rn'] = Parser.ParseRegister(RegExp.$1);
                r['Writeback'] = RegExp.$2 ? true : false;
                r['S'] = RegExp.$4 ? true : false;
                r['RList'] = [];
                var t = RegExp.$3.split(',');
                for (var i in t) {
                    if (!t.hasOwnProperty(i))
                        continue;
                    var e = t[i].trim();
                    if (e.match(/^R(\d{1,2})\s*-\s*R(\d{1,2})$/i)) {
                        var a = parseInt(RegExp.$1), b = parseInt(RegExp.$2);
                        if (a >= b)
                            throw new RangeError("Bad register range [" + a + "," + b + "]");
                        if (a > 15 || b > 15)
                            throw new SyntaxError('ARM register expected (R0 - R15)');
                        for (var c = a; c <= b; c++)
                            r['RList'].push("R" + c);
                    }
                    else
                        r['RList'].push(Parser.ParseRegister(e));
                }
                return r;
            };
            Parser.prototype.ParseOperands_10 = function (s) {
                var r = {}, m = s.trim().match(/^(\w+)\s*,\s*(\w+)\s*,\s*\[\s*(\w+)\s*]$/i);
                if (!m)
                    throw new SyntaxError("ARM register identifier expected " + s);
                for (var i = 1; i < 4; i++) {
                    r[("Op" + i)] = Parser.ParseRegister(m[i]);
                    if (r[("Op" + i)] == 'R15')
                        throw new Error('R15 must not be used as operand');
                }
                return r;
            };
            Parser.prototype.ParseOperands_11 = function (s) {
                var r = {}, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length < 5 || a.length > 6)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                if (a[0][0].toUpperCase() != 'P')
                    throw new SyntaxError("Coprocessor number expected " + s);
                r['CP'] = parseInt(a[0].substr(1));
                if (r['CP'] > 15)
                    throw new Error("Coprocessor number out of range " + r['CP']);
                var t = this.ParseExpression(a[1]);
                if (t > 15)
                    throw new RangeError('Expression out of range');
                r['CPOpc'] = t;
                r['Cd'] = Parser.ParseCPRegister(a[2]);
                r['Cn'] = Parser.ParseCPRegister(a[3]);
                r['Cm'] = Parser.ParseCPRegister(a[4]);
                if (a.length == 6) {
                    t = this.ParseExpression(a[5]);
                    if (t > 7)
                        throw new RangeError('Expression out of range');
                    r['CPType'] = t;
                }
                return r;
            };
            Parser.prototype.ParseOperands_12 = function (s) {
                var r = {};
                if (!s.trim().match(/^P(\d{1,2})\s*,\s*(\w+)\s*,\s*(.*)$/i))
                    throw new SyntaxError("Invalid instruction syntax " + s);
                r['CP'] = parseInt(RegExp.$1);
                if (r['CP'] > 15)
                    throw new Error("Coprocessor number out of range " + r['CP']);
                r['Cd'] = Parser.ParseCPRegister(RegExp.$2);
                var a = this.ParseAddress(RegExp.$3.trim());
                if (a.Offset > 0xFF)
                    throw new RangeError("Coprocessor offset out of range " + a.Offset);
                if (a.Shift)
                    throw new SyntaxError('Invalid coprocessor offset');
                return Assembler.Util.MergeObjects(a, r);
            };
            Parser.prototype.ParseOperands_13 = function (s) {
                var r = {}, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length < 5 || a.length > 6)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                if (a[0][0].toUpperCase() != 'P')
                    throw new SyntaxError("Coprocessor number expected " + s);
                r['CP'] = parseInt(a[0].substr(1));
                if (r['CP'] > 15)
                    throw new Error("Coprocessor number out of range " + r['CP']);
                var t = this.ParseExpression(a[1]);
                if (t > 15)
                    throw new RangeError('Expression out of range');
                r['CPOpc'] = t;
                r['Rd'] = Parser.ParseRegister(a[2]);
                r['Cn'] = Parser.ParseCPRegister(a[3]);
                r['Cm'] = Parser.ParseCPRegister(a[4]);
                if (a.length == 6) {
                    t = this.ParseExpression(a[5]);
                    if (t > 7)
                        throw new RangeError('Expression out of range');
                    r['CPType'] = t;
                }
                return r;
            };
            Parser.prototype.ParseOperands_14 = function (s) {
                var r = {}, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length == 1)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                r['Rd'] = Parser.ParseRegister(a[0]);
                var isRotated = false;
                try {
                    r['Op2'] = Parser.ParseRegister(a[1]);
                }
                catch (e) {
                    var t = this.ParseExpression(a[1]), enc = Assembler.Util.EncodeImmediate(t);
                    isRotated = enc.Rotate > 0;
                    r['Immediate'] = true;
                    r['Op2'] = enc;
                }
                if (a.length == 2)
                    return r;
                if (r['Immediate']) {
                    if (isRotated)
                        throw new Error('Illegal shift on rotated value');
                    var t = this.ParseExpression(a[2]);
                    if ((t % 2) || t < 0 || t > 30)
                        throw new Error("Invalid rotation: " + t);
                    r['Op2'].Rotate = t / 2;
                }
                else {
                    if (a[2].match(/^(ASL|LSL|LSR|ASR|ROR)\s*(.*)$/i)) {
                        r['ShiftOp'] = RegExp.$1;
                        var f = RegExp.$2;
                        try {
                            r['Shift'] = Parser.ParseRegister(f);
                        }
                        catch (e) {
                            var t = this.ParseExpression(f);
                            if (t > 31)
                                throw new Error('Expression out of range');
                            r['Shift'] = t;
                        }
                    }
                    else if (a[2].match(/^RRX$/i)) {
                        r['Rrx'] = true;
                    }
                    else
                        throw new SyntaxError('Invalid expression');
                }
                if (a.length > 3)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                return r;
            };
            Parser.prototype.ParseOperands_15 = function (s) {
                return {};
            };
            Parser.prototype.ParseOperands_16 = function (s) {
                if (!s.trim().match(/^{(.*)}\s*$/i))
                    throw new SyntaxError("Invalid instruction syntax " + s);
                var r = { Rn: 'R13', Writeback: true, Mode: 'FD' }, a = RegExp.$1.split(',');
                r['RList'] = [];
                for (var i in a) {
                    if (!a.hasOwnProperty(i))
                        continue;
                    var e = a[i].trim();
                    if (e.match(/^R(\d{1,2})\s*-\s*R(\d{1,2})$/i)) {
                        var from = parseInt(RegExp.$1), to = parseInt(RegExp.$2);
                        if (from >= to)
                            throw new RangeError("Bad register range [" + from + "," + to + "]");
                        if (from > 15 || to > 15)
                            throw new SyntaxError('ARM register expected (R0 - R15)');
                        for (var c = from; c <= to; c++)
                            r['RList'].push("R" + c);
                    }
                    else
                        r['RList'].push(Parser.ParseRegister(e));
                }
                return r;
            };
            Parser.prototype.ParseOperands_17 = function (s) {
                var r = {}, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length < 2 || a.length > 3)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                r['Rd'] = Parser.ParseRegister(a[0]);
                var isReg = false;
                try {
                    r['Op2'] = Parser.ParseRegister(a[1]);
                    isReg = true;
                }
                catch (e) {
                    r['Op2'] = r['Rd'];
                    r['Shift'] = this.ParseExpression(a[1]);
                    return r;
                }
                if (isReg && a.length == 2)
                    throw new SyntaxError("Shift expression expected " + s);
                r['Shift'] = this.ParseExpression(a[2]);
                return r;
            };
            Parser.prototype.ParseOperands_18 = function (s) {
                var r = { Rd: '', Op2: '', Rrx: true }, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length != 2)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                r.Rd = Parser.ParseRegister(a[0]);
                r.Op2 = Parser.ParseRegister(a[1]);
                return r;
            };
            Parser.prototype.ParseOperands_19 = function (s) {
                var r = {}, a = s.split(',').map(function (v) { return v.trim(); });
                if (a.length == 1)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                r['Rn'] = Parser.ParseRegister(a[0]);
                var isRotated = false;
                try {
                    r['Op2'] = Parser.ParseRegister(a[1]);
                }
                catch (e) {
                    var t = this.ParseExpression(a[1]), enc = Assembler.Util.EncodeImmediate(t);
                    isRotated = enc.Rotate > 0;
                    r['Immediate'] = true;
                    r['Op2'] = enc;
                }
                if (a.length == 2)
                    return r;
                if (r['Immediate']) {
                    if (isRotated)
                        throw new Error('Illegal shift on rotated value');
                    var t = this.ParseExpression(a[2]);
                    if ((t % 2) || t < 0 || t > 30)
                        throw new Error("Invalid rotation: " + t);
                    r['Op2'].Rotate = t / 2;
                }
                else {
                    if (a[2].match(/^(ASL|LSL|LSR|ASR|ROR)\s*(.*)$/i)) {
                        r['ShiftOp'] = RegExp.$1;
                        var f = RegExp.$2;
                        try {
                            r['Shift'] = Parser.ParseRegister(f);
                        }
                        catch (e) {
                            var t = this.ParseExpression(f);
                            if (t > 31)
                                throw new Error('Expression out of range');
                            r['Shift'] = t;
                        }
                    }
                    else if (a[2].match(/^RRX$/i)) {
                        r['Rrx'] = true;
                    }
                    else
                        throw new SyntaxError('Invalid expression');
                }
                if (a.length > 3)
                    throw new SyntaxError("Invalid instruction syntax " + s);
                return r;
            };
            Parser.mnemonics = [
                'ADC', 'ADD', 'AND', 'B', 'BIC', 'BL', 'BX', 'CDP', 'CMN', 'CMP', 'EOR', 'LDC', 'LDM',
                'LDR', 'MCR', 'MLA', 'MOV', 'MRC', 'MRS', 'MSR', 'MUL', 'MVN', 'ORR', 'RSB', 'RSC',
                'SBC', 'STC', 'STM', 'STR', 'SUB', 'SWI', 'SWP', 'TEQ', 'TST', 'NOP', 'PUSH', 'POP',
                'UMULL', 'UMLAL', 'SMULL', 'SMLAL', 'LSL', 'LSR', 'ASR', 'ROR', 'RRX'
            ];
            Parser.conditions = [
                'EQ', 'NE', 'CS', 'CC', 'MI', 'PL', 'VS', 'VC', 'HI', 'LS', 'GE', 'LT',
                'GT', 'LE', 'AL'
            ];
            Parser.suffixes = {
                'AND': [{ Suffix: 'S' }], 'EOR': [{ Suffix: 'S' }], 'SUB': [{ Suffix: 'S' }],
                'RSB': [{ Suffix: 'S' }], 'ADD': [{ Suffix: 'S' }], 'ADC': [{ Suffix: 'S' }],
                'SBC': [{ Suffix: 'S' }], 'RSC': [{ Suffix: 'S' }], 'ORR': [{ Suffix: 'S' }],
                'BIC': [{ Suffix: 'S' }], 'MUL': [{ Suffix: 'S' }], 'MLA': [{ Suffix: 'S' }],
                'MOV': [{ Suffix: 'S' }], 'MVN': [{ Suffix: 'S' }],
                'ASR': [{ Suffix: 'S' }], 'ROR': [{ Suffix: 'S' }], 'RRX': [{ Suffix: 'S' }],
                'SWP': [{ Suffix: 'B' }], 'LDC': [{ Suffix: 'L' }], 'STC': [{ Suffix: 'L' }],
                'LDR': [{ Suffix: 'BT|B|T|H|SH|SB', Name: 'Mode' }],
                'STR': [{ Suffix: 'BT|B|T|H', Name: 'Mode' }],
                'LDM': [{ Suffix: 'FD|ED|FA|EA|IA|IB|DA|DB', Required: true, Name: 'Mode' }],
                'STM': [{ Suffix: 'FD|ED|FA|EA|IA|IB|DA|DB', Required: true, Name: 'Mode' }],
                'UMULL': [{ Suffix: 'S' }], 'UMLAL': [{ Suffix: 'S' }], 'SMULL': [{ Suffix: 'S' }],
                'SMLAL': [{ Suffix: 'S' }], 'LSL': [{ Suffix: 'S' }], 'LSR': [{ Suffix: 'S' }]
            };
            return Parser;
        }());
        Assembler.Parser = Parser;
    })(Assembler = ARM.Assembler || (ARM.Assembler = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Assembler;
    (function (Assembler) {
        var Section = (function () {
            function Section(name) {
                this.committed = false;
                this.size = 0;
                this.pos = 0;
                this.buffer = null;
                this.uint8view = null;
                this.uint16view = null;
                this.uint32view = null;
                this.name = name;
            }
            Object.defineProperty(Section.prototype, "Name", {
                get: function () {
                    return this.name;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Section.prototype, "Size", {
                get: function () {
                    return this.size;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Section.prototype, "Position", {
                get: function () {
                    return this.pos;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Section.prototype, "Buffer", {
                get: function () {
                    return this.buffer;
                },
                enumerable: true,
                configurable: true
            });
            Section.prototype.Grow = function (numBytes) {
                if (this.committed)
                    throw new Error('Section has already been committed');
                this.size = this.size + numBytes;
            };
            Section.prototype.Commit = function () {
                var align = 4;
                if (this.size % align)
                    this.Grow(align - (this.size % align));
                this.buffer = new ArrayBuffer(this.size);
                this.uint8view = new Uint8Array(this.buffer);
                this.uint16view = new Uint16Array(this.buffer);
                this.uint32view = new Uint32Array(this.buffer);
                this.committed = true;
                this.pos = 0;
            };
            Section.prototype.Write = function (value, type) {
                if (!this.committed)
                    throw new Error('Section has not been committed');
                var sizes = { 'BYTE': 1, 'HWORD': 2, 'WORD': 4, '2BYTE': 2, '4BYTE': 4 }, view = null;
                switch (type) {
                    case 'BYTE':
                        view = new Uint8Array(this.buffer);
                        break;
                    case 'HWORD':
                    case '2BYTE':
                        view = new Uint16Array(this.buffer);
                        break;
                    case 'WORD':
                    case '4BYTE':
                        view = new Uint32Array(this.buffer);
                        break;
                    default:
                        throw new Error("Invalid data type " + type);
                }
                var index = this.pos;
                if ((index % sizes[type]) != 0)
                    throw new Error("Trying to write " + type + " value at un-aligned offset " + index);
                index = index / sizes[type];
                view[index] = value;
                this.pos += sizes[type];
            };
            return Section;
        }());
        Assembler.Section = Section;
    })(Assembler = ARM.Assembler || (ARM.Assembler = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Assembler;
    (function (Assembler) {
        var Symbol = (function () {
            function Symbol(name, value, label, section) {
                if (section === void 0) { section = null; }
                this.value = null;
                this.label = false;
                this.section = null;
                this.name = name;
                this.value = value;
                this.label = label;
                this.section = section;
            }
            Object.defineProperty(Symbol.prototype, "Name", {
                get: function () {
                    return this.name;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Symbol.prototype, "Value", {
                get: function () {
                    return this.value;
                },
                set: function (value) {
                    this.value = value;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Symbol.prototype, "Label", {
                get: function () {
                    return this.label;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Symbol.prototype, "Section", {
                get: function () {
                    return this.section;
                },
                enumerable: true,
                configurable: true
            });
            return Symbol;
        }());
        Assembler.Symbol = Symbol;
    })(Assembler = ARM.Assembler || (ARM.Assembler = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Assembler;
    (function (Assembler_1) {
        var Assembler = (function () {
            function Assembler(layout) {
                var _this = this;
                this.selectedSection = null;
                this.sections = {};
                this.symbols = {};
                this.litpools = new Array();
                this.layout = {};
                this.parser = new Assembler_1.Parser(function (s) { return _this.ResolveSymbol(s); }, function () { return _this.selectedSection.Position; });
                var name = 'TEXT';
                this.sections[name] = new Assembler_1.Section(name);
                this.selectedSection = this.sections[name];
                this.layout = layout;
            }
            Assembler.Assemble = function (source, layout) {
                var asm = new Assembler(layout), lines = asm.GetSourceLines(source);
                lines = asm.Pass_0(lines);
                asm.CreateLitPool(asm.sections['TEXT'].Size);
                for (var name_1 in asm.sections)
                    asm.sections[name_1].Commit();
                asm.Pass_1(lines);
                var ret = {};
                for (var s in asm.sections) {
                    ret[s] = {
                        address: layout[s],
                        data: new Uint8Array(asm.sections[s].Buffer)
                    };
                }
                return ret;
            };
            Assembler.prototype.GetSourceLines = function (source) {
                var lines = new Array();
                for (var _i = 0, _a = Assembler_1.Util.StripComments(source).split('\n'); _i < _a.length; _i++) {
                    var line = _a[_i];
                    if ((line = line.replace(/\t/g, ' ').trim()) != '')
                        lines.push(line);
                }
                return lines;
            };
            Assembler.prototype.Pass_0 = function (lines) {
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (line.match(/^(.*):(.*)$/)) {
                        this.ProcessLabel(RegExp.$1.trim());
                        line = lines[i] = RegExp.$2.trim();
                        if (line == '')
                            continue;
                    }
                    if (line.match(/^\.(\w+)\s*(.*)/)) {
                        if (this.ProcessDirective_0(RegExp.$1, RegExp.$2))
                            lines[i] = '';
                    }
                    else {
                        this.selectedSection.Grow(4);
                    }
                }
                return lines.filter(function (s) { return s != ''; });
            };
            Assembler.prototype.IsValidDirective = function (s) {
                var directives = [
                    'ARM', 'THUMB', 'CODE32', 'CODE16', 'FORCE_THUMB', 'THUMB_FUNC',
                    'LTORG', 'EQU', 'SET', 'BYTE', 'WORD', 'HWORD', '2BYTE', '4BYTE',
                    'ASCII', 'ASCIZ', 'DATA', 'TEXT', 'END', 'EXTERN', 'GLOBAL',
                    'INCLUDE', 'SKIP', 'REG', 'ALIGN', 'SECTION', 'FILE', 'RODATA',
                    'BSS', 'FUNC', 'ENDFUNC'
                ];
                return directives.indexOf(s) >= 0;
            };
            Assembler.prototype.ProcessDirective_0 = function (directive, params) {
                directive = directive.toUpperCase().trim();
                if (!this.IsValidDirective(directive))
                    throw new Error("Unknown assembler directive: " + directive);
                switch (directive) {
                    case 'SECTION':
                        if (!params)
                            throw new Error('Missing argument for .SECTION');
                        this.SwitchSection(params.replace(/^\./, '').toUpperCase());
                        break;
                    case 'DATA':
                    case 'TEXT':
                    case 'RODATA':
                    case 'BSS':
                        this.SwitchSection(directive);
                        break;
                    case 'EQU':
                    case 'SET':
                        this.ProcessEQU(params);
                        return true;
                    case 'ASCII':
                    case 'ASCIZ':
                        var strLength = this.ProcessStringLiterals(params, directive == 'ASCIZ', true);
                        this.selectedSection.Grow(strLength);
                        break;
                    case 'ALIGN':
                        var sectionSize = this.selectedSection.Size, align = params ? parseInt(eval(params)) : 4;
                        if (isNaN(align))
                            throw new Error("Invalid alignment for .ALIGN directive " + params);
                        if (sectionSize % align)
                            this.selectedSection.Grow(align - (sectionSize % align));
                        break;
                    case 'SKIP':
                        if (!params)
                            throw new Error('Missing argument for .SKIP');
                        var numBytes = parseInt(eval(params));
                        if (isNaN(numBytes))
                            throw new Error("Invalid argument for .SKIP directive " + params);
                        this.selectedSection.Grow(numBytes);
                        break;
                    case 'BYTE':
                    case 'HWORD':
                    case 'WORD':
                    case '2BYTE':
                    case '4BYTE':
                        var typeSize = { 'BYTE': 1, 'HWORD': 2, 'WORD': 4, '2BYTE': 2, '4BYTE': 4 }, numElems = params.split(',').length, size = typeSize[directive] * numElems;
                        this.selectedSection.Grow(size);
                        break;
                }
                return false;
            };
            Assembler.prototype.SwitchSection = function (name) {
                if (!this.sections[name])
                    this.sections[name] = new Assembler_1.Section(name);
                this.selectedSection = this.sections[name];
            };
            Assembler.prototype.ProcessLabel = function (name) {
                if (this.symbols[name])
                    throw new Error("Symbol re-definition: \"" + name + "\"");
                this.symbols[name] = new Assembler_1.Symbol(name, this.selectedSection.Size, true, this.selectedSection);
            };
            Assembler.prototype.ProcessEQU = function (params) {
                params = params.trim();
                if (!params.match(/^(\w+),(.*)$/))
                    throw new Error("Invalid arguments for .EQU directive " + params);
                var name = RegExp.$1.trim(), value = RegExp.$2.trim();
                if (this.symbols[name])
                    throw new Error("Symbol re-definition: \"" + name + "\"");
                for (var key in this.symbols) {
                    var symbol = this.symbols[key];
                    if (symbol.Label)
                        continue;
                    value = value.replace(new RegExp(key, 'g'), symbol.Value);
                }
                this.symbols[name] = new Assembler_1.Symbol(name, value, false);
                for (var key in this.symbols) {
                    var symbol = this.symbols[key];
                    if (key == name || symbol.Label)
                        continue;
                    symbol.Value = symbol.Value.replace(new RegExp(name, 'g'), value);
                }
            };
            Assembler.prototype.ProcessStringLiterals = function (literals, nullTerminated, computeLengthOnly) {
                if (computeLengthOnly === void 0) { computeLengthOnly = false; }
                try {
                    var list = eval("[" + literals + "]"), length_1 = 0;
                    for (var _i = 0, list_1 = list; _i < list_1.length; _i++) {
                        var str = list_1[_i];
                        if (!computeLengthOnly) {
                            for (var i = 0; i < str.length; i++)
                                this.selectedSection.Write(str.charCodeAt(i) & 0xFF, 'BYTE');
                            if (nullTerminated)
                                this.selectedSection.Write(0x00, 'BYTE');
                        }
                        length_1 = length_1 + str.length + (nullTerminated ? 1 : 0);
                    }
                    return length_1;
                }
                catch (e) {
                    throw new Error("Invalid literals " + literals + ": " + e);
                }
            };
            Assembler.prototype.Pass_1 = function (lines) {
                for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                    var line = lines_1[_i];
                    if (line.match(/^\.(\w+)\s*(.*)/)) {
                        this.ProcessDirective_1(RegExp.$1, RegExp.$2);
                    }
                    else {
                        var iw = this.AssembleInstruction(line);
                        this.selectedSection.Write(iw, 'WORD');
                    }
                }
            };
            Assembler.prototype.AssembleInstruction = function (line) {
                var data = Assembler_1.Parser.ParseMnemonic(line), operands = this.parser.ParseOperands(data[0]['Mnemonic'], data[1]);
                return this.BuildInstruction(Assembler_1.Util.MergeObjects(data[0], operands));
            };
            Assembler.prototype.ProcessDirective_1 = function (directive, params) {
                directive = directive.toUpperCase().trim();
                if (!this.IsValidDirective(directive))
                    throw new Error("Unknown assembler directive: " + directive);
                switch (directive) {
                    case 'SECTION':
                        if (!params)
                            throw new Error('Missing argument for .SECTION');
                        this.SwitchSection(params.replace(/^\./, '').toUpperCase());
                        break;
                    case 'DATA':
                    case 'TEXT':
                    case 'RODATA':
                    case 'BSS':
                        this.SwitchSection(directive);
                        break;
                    case 'ASCII':
                    case 'ASCIZ':
                        this.ProcessStringLiterals(params, directive == 'ASCIZ');
                        break;
                    case 'ALIGN':
                        var sectionSize = this.selectedSection.Position, align = params ? parseInt(eval(params)) : 4;
                        if (isNaN(align))
                            throw new Error("Invalid alignment for .ALIGN directive " + params);
                        if (sectionSize % align) {
                            var pad = align - (sectionSize % align);
                            for (var i = 0; i < pad; i++)
                                this.selectedSection.Write(0x00, 'BYTE');
                        }
                        break;
                    case 'SKIP':
                        if (!params)
                            throw new Error('Missing argument for .SKIP');
                        var numBytes = parseInt(eval(params));
                        if (isNaN(numBytes))
                            throw new Error("Invalid argument for .SKIP directive " + params);
                        this.selectedSection.Position += numBytes;
                        break;
                    case 'BYTE':
                    case 'HWORD':
                    case 'WORD':
                    case '2BYTE':
                    case '4BYTE':
                        this.ProcessData(directive, params);
                        break;
                }
                return false;
            };
            Assembler.prototype.ProcessData = function (directive, data) {
                var e = { 'BYTE': 1, 'HWORD': 2, 'WORD': 4, '2BYTE': 2, '4BYTE': 4 }, size = e[directive.toUpperCase()];
                var min = (-(1 << (size * 8 - 1))) & 0xffffffff;
                for (var _i = 0, _a = data.split(','); _i < _a.length; _i++) {
                    var lit = _a[_i];
                    lit = lit.trim();
                    var num = this.parser.ParseExpression(lit);
                    if (num < min) {
                        console.info("Warning: " + num + " truncated to " + min);
                        num = min;
                    }
                    this.selectedSection.Write(num, directive);
                }
            };
            Assembler.prototype.CreateLitPool = function (position) {
                var litpool = new Assembler_1.Litpool(this.sections['TEXT'], position);
                this.litpools.push(litpool);
            };
            Assembler.prototype.GetNearestLitPool = function (position) {
                return this.litpools[0];
            };
            Assembler.prototype.ResolveSymbol = function (name) {
                if (!this.symbols.hasOwnProperty(name))
                    throw new Error("Unresolved symbol " + name);
                var symbol = this.symbols[name];
                var value = symbol.Value;
                if (symbol.Label) {
                    if (!this.layout.hasOwnProperty(symbol.Section.Name))
                        throw new Error("No memory layout for section " + symbol.Section.Name);
                    value = value + this.layout[symbol.Section.Name];
                }
                return value;
            };
            Assembler.prototype.ConditionMask = function (conditionCode) {
                var m = {
                    'EQ': 0x00, 'NE': 0x01, 'CS': 0x02, 'CC': 0x03, 'MI': 0x04,
                    'PL': 0x05, 'VS': 0x06, 'VC': 0x07, 'HI': 0x08, 'LS': 0x09,
                    'GE': 0x0A, 'LT': 0x0B, 'GT': 0x0C, 'LE': 0x0D, 'AL': 0x0E
                };
                if (!conditionCode)
                    return m['AL'];
                if (typeof (m[conditionCode]) == 'undefined')
                    throw new Error("Invalid condition code " + conditionCode);
                return m[conditionCode];
            };
            Assembler.prototype.BuildInstruction = function (data) {
                var lookup = [
                    [['BX'], 0],
                    [['B', 'BL'], 1],
                    [['AND', 'EOR', 'SUB', 'RSB', 'ADD', 'ADC',
                            'SBC', 'RSC', 'ORR', 'BIC', 'MOV', 'MVN'], 2],
                    [['MRS'], 3],
                    [['MSR'], 4],
                    [['MUL', 'MLA'], 5],
                    [['UMULL', 'UMLAL', 'SMULL', 'SMLAL'], 6],
                    [['LDR', 'STR'], 7],
                    [['LDM', 'STM'], 9],
                    [['SWP'], 10],
                    [['SWI'], 11],
                    [['CDP'], 12],
                    [['LDC', 'STC'], 13],
                    [['MRC', 'MCR'], 14],
                    [['PUSH', 'POP'], 15],
                    [['LSL', 'LSR', 'ASR', 'ROR'], 16],
                    [['RRX'], 17],
                    [['NOP'], 18],
                    [['CMP', 'CMN', 'TEQ', 'TST'], 19]
                ];
                for (var _i = 0, lookup_2 = lookup; _i < lookup_2.length; _i++) {
                    var entry = lookup_2[_i];
                    if (entry[0].indexOf(data.Mnemonic) >= 0)
                        return this[("BuildInstruction_" + entry[1])](data);
                }
                throw new SyntaxError("Invalid Mnemonic " + data.Mnemonic);
            };
            Assembler.prototype.BuildInstruction_0 = function (data) {
                var bxMask = 0x12FFF10, cm = this.ConditionMask(data.Condition), rn = parseInt(data.Rn.substr(1));
                return (cm << 28) | bxMask | rn;
            };
            Assembler.prototype.BuildInstruction_1 = function (data) {
                var l = data.Mnemonic == 'BL' ? 1 : 0, mask = 0xA000000, cm = this.ConditionMask(data.Condition), relOffset = data.Offset - this.selectedSection.Position - 8, of = (relOffset >>> 2) & 0xFFFFFF;
                return (cm << 28) | (l << 24) | mask | of;
            };
            Assembler.prototype.BuildInstruction_2 = function (data) {
                var opcodes = {
                    'AND': 0, 'EOR': 1, 'SUB': 2, 'RSB': 3, 'ADD': 4, 'ADC': 5,
                    'SBC': 6, 'RSC': 7, 'ORR': 12, 'MOV': 13, 'BIC': 14, 'MVN': 15
                }, cm = this.ConditionMask(data.Condition), s = data.S ? 1 : 0, i = data.Immediate ? 1 : 0, rd = parseInt(data.Rd.substr(1)), rn = data.Rn ? parseInt(data.Rn.substr(1)) : 0, op2;
                if (i) {
                    if (data.Mnemonic == 'MOV' && data.Op2.Negative)
                        data.Mnemonic = 'MVN';
                    else if (data.Mnemonic == 'MVN' && !data.Op2.Negative)
                        data.Mnemonic = 'MOV';
                    op2 = (data.Op2.Rotate << 8) | data.Op2.Immediate;
                }
                else {
                    var stypes = { 'LSL': 0, 'LSR': 1, 'ASL': 0, 'ASR': 2, 'ROR': 3 };
                    var sf = 0;
                    if (data.Shift && data.ShiftOp) {
                        var st = stypes[data.ShiftOp];
                        if (Assembler_1.Util.IsRegister(data.Shift))
                            sf = (parseInt(data.Shift.substr(1)) << 4) | (st << 1) | (1);
                        else
                            sf = (data.Shift << 3) | (st << 1);
                    }
                    op2 = (sf << 4) | parseInt(data.Op2.substr(1));
                }
                var opc = opcodes[data.Mnemonic];
                if (opc > 7 && opc < 12)
                    s = 1;
                return (cm << 28) | (i << 25) | (opc << 21) | (s << 20) | (rn << 16) |
                    (rd << 12) | (op2);
            };
            Assembler.prototype.BuildInstruction_3 = function (data) {
                var cm = this.ConditionMask(data.Condition), rd = parseInt(data.Rd.substr(1)), p = (data.P == 'CPSR' || data.P == 'CPSR_ALL') ? 0 : 1, mask = 0x10F0000;
                return (cm << 28) | (p << 22) | (rd << 12) | mask;
            };
            Assembler.prototype.BuildInstruction_4 = function (data) {
                var cm = this.ConditionMask(data.Condition), r;
                if (data.P == 'CPSR_FLG' || data.P == 'SPSR_FLG') {
                    var i = Assembler_1.Util.IsRegister(data.Op2) ? 0 : 1, p = data.P == 'CPSR_FLG' ? 0 : 1, s = void 0, mask = 0x128F000;
                    if (!i)
                        s = parseInt(data.Op2.substr(1));
                    else {
                        throw new Error('Not implemented');
                    }
                    r = (cm << 28) | (i << 25) | (p << 22) | mask | s;
                }
                else {
                    var p = (data.P == 'CPSR' || data.P == 'CPSR_ALL') ? 0 : 1, rm = parseInt(data.Op2.substr(1)), mask = 0x129F000;
                    r = (cm << 28) | (p << 22) | mask | rm;
                }
                return r;
            };
            Assembler.prototype.BuildInstruction_5 = function (data) {
                var cm = this.ConditionMask(data.Condition), a = data.Mnemonic == 'MLA' ? 1 : 0, s = data.S ? 1 : 0, rd = parseInt(data.Op1.substr(1)), rs = parseInt(data.Op2.substr(1)), rm = parseInt(data.Op3.substr(1)), rn = a ? parseInt(data.Op4.substr(1)) : 0, mask = 0x90;
                return (cm << 28) | (a << 21) | (s << 20) | (rd << 16) | (rn << 12) |
                    (rs << 8) | mask | rm;
            };
            Assembler.prototype.BuildInstruction_6 = function (data) {
                var cm = this.ConditionMask(data.Condition), rdLo = parseInt(data.Op1.substr(1)), rdHi = parseInt(data.Op2.substr(2)), rm = parseInt(data.Op3.substr(1)), rs = parseInt(data.Op4.substr(1)), u = (data.Mnemonic == 'UMULL' || data.Mnemonic == 'UMLAL') ? 1 : 0, a = (data.Mnemonic == 'UMLAL' || data.Mnemonic == 'SMLAL') ? 1 : 0, s = data.S ? 1 : 0, mask = 0x800090;
                return (cm << 28) | (u << 22) | (a << 21) | (s << 20) | (rdHi << 16) |
                    (rdLo << 12) | (rs << 8) | mask | rm;
            };
            Assembler.prototype.BuildInstruction_7 = function (data) {
                if (data.Mode && data.Mode.match(/^H|SH|SB$/))
                    return this.BuildInstruction_8(data);
                var cm = this.ConditionMask(data.Condition), rd = parseInt(data.Rd.substr(1)), p = data.Type == 'Pre' ? 1 : 0, w = data.Writeback ? 1 : 0, i = data.Immediate ? 0 : 1, u = data.Subtract ? 0 : 1, l = data.Mnemonic == 'LDR' ? 1 : 0, b = (data.Mode == 'B' || data.Mode == 'BT') ? 1 : 0;
                if (data.Pseudo) {
                    try {
                        var imm = Assembler_1.Util.EncodeImmediate(data.Offset);
                        return this.BuildInstruction_2({
                            Immediate: true,
                            Mnemonic: imm.Negative ? 'MVN' : 'MOV',
                            Condition: data.Condition || null,
                            Op2: imm,
                            Rd: data.Rd
                        });
                    }
                    catch (e) {
                        var litpool = this.GetNearestLitPool(this.selectedSection.Position);
                        var relOffset = litpool.Put(data.Offset) -
                            (this.selectedSection.Position + 8);
                        if (relOffset < 0) {
                            u = 0;
                            relOffset *= -1;
                        }
                        else
                            u = 1;
                        i = w = b = 0;
                        p = 1;
                        data.Source = 'R15';
                        data.Offset = relOffset;
                        data.Type = 'Post';
                    }
                }
                var mask = 0x4000000, rn = parseInt(data.Source.substr(1)), offset = data.Offset || 0;
                if (i == 1 && data.Offset) {
                    var stypes = { 'LSL': 0, 'LSR': 1, 'ASL': 0, 'ASR': 2, 'ROR': 3 }, reg = parseInt(data.Offset.substr(1)), shift = data.Shift ? ((data.Shift << 3) | (stypes[data.ShiftOp] << 1)) : 0;
                    offset = (shift << 4) | reg;
                }
                return (cm << 28) | mask | (i << 25) | (p << 24) | (u << 23) | (b << 22) |
                    (w << 21) | (l << 20) | (rn << 16) | (rd << 12) | offset;
            };
            Assembler.prototype.BuildInstruction_8 = function (data) {
                var cm = this.ConditionMask(data.Condition), rd = parseInt(data.Rd.substr(1)), rn = parseInt(data.Source.substr(1)), l = data.Mnemonic == 'LDR' ? 1 : 0, p = data.Type == 'Pre' ? 1 : 0, w = data.Writeback ? 1 : 0, u = data.Subtract ? 0 : 1, i = data.Immediate ? 1 : 0, modes = { 'H': 1, 'SB': 2, 'SH': 3 }, m = modes[data.Mode], loNibble = 0, hiNibble = 0;
                if (i == 0 && data.Offset)
                    loNibble = parseInt(data.Offset.substr(1));
                else if (data.Offset) {
                    loNibble = data.Offset & 0xF;
                    hiNibble = (data.Offset >> 4) & 0xF;
                }
                return (cm << 28) | (p << 24) | (u << 23) | (w << 21) | (l << 20) |
                    (rn << 16) | (rd << 12) | (hiNibble << 8) | (m << 5) | loNibble;
            };
            Assembler.prototype.BuildInstruction_9 = function (data) {
                var cm = this.ConditionMask(data.Condition), mask = 0x8000000, rn = parseInt(data.Rn.substr(1)), w = data.Writeback ? 1 : 0, s = data.S ? 1 : 0, modes = {
                    'LDMED': [1, 1, 1], 'LDMFD': [1, 0, 1], 'LDMEA': [1, 1, 0],
                    'LDMFA': [1, 0, 0], 'LDMIB': [1, 1, 1], 'LDMIA': [1, 0, 1],
                    'LDMDB': [1, 1, 0], 'LDMDA': [1, 0, 0],
                    'STMFA': [0, 1, 1], 'STMEA': [0, 0, 1], 'STMFD': [0, 1, 0],
                    'STMED': [0, 0, 0], 'STMIB': [0, 1, 1], 'STMIA': [0, 0, 1],
                    'STMDB': [0, 1, 0], 'STMDA': [0, 0, 0]
                }, m = modes[data.Mnemonic + data.Mode], l = m[0], p = m[1], u = m[2], rList = 0;
                for (var i = 0; i < data.RList.length; i++) {
                    var reg = parseInt(data.RList[i].substr(1));
                    rList |= (1 << reg);
                }
                return (cm << 28) | mask | (p << 24) | (u << 23) | (s << 22) | (w << 21) |
                    (l << 20) | (rn << 16) | rList;
            };
            Assembler.prototype.BuildInstruction_10 = function (data) {
                var cm = this.ConditionMask(data.Condition), mask = 0x1000090, b = data.B ? 1 : 0, rd = parseInt(data.Op1.substr(1)), rm = parseInt(data.Op2.substr(1)), rn = parseInt(data.Op3.substr(1));
                return (cm << 28) | mask | (b << 22) | (rn << 16) | (rd << 12) | rm;
            };
            Assembler.prototype.BuildInstruction_11 = function (data) {
                var cm = this.ConditionMask(data.Condition), mask = 0xF000000;
                return (cm << 28) | mask | data.Offset;
            };
            Assembler.prototype.BuildInstruction_12 = function (data) {
                var _cm = this.ConditionMask(data.Condition), mask = 0xE000000, cn = parseInt(data.Cn.substr(1)), cm = parseInt(data.Cm.substr(1)), cd = parseInt(data.Cd.substr(1)), type = data.CPType || 0;
                return (_cm << 28) | mask | (data.CPOpc << 20) | (cn << 16) | (cd << 12) |
                    (data.CP << 8) | (type << 5) | cm;
            };
            Assembler.prototype.BuildInstruction_13 = function (data) {
                var cm = this.ConditionMask(data.Condition), mask = 0xC000000, n = data.L ? 1 : 0, cd = parseInt(data.Cd.substr(1)), rn = parseInt(data.Source.substr(1)), l = data.Mnemonic == 'LDC' ? 1 : 0, p = data.Type == 'Pre' ? 1 : 0, w = data.Writeback ? 1 : 0, u = data.Subtract ? 0 : 1;
                return (cm << 28) | mask | (p << 24) | (u << 23) | (n << 22) | (w << 21) |
                    (l << 20) | (rn << 16) | (cd << 12) | (data.CP << 8) | data.Offset;
            };
            Assembler.prototype.BuildInstruction_14 = function (data) {
                var _cm = this.ConditionMask(data.Condition), mask = 0xE000010, l = data.Mnemonic == 'MRC' ? 1 : 0, rd = parseInt(data.Rd.substr(1)), cn = parseInt(data.Cn.substr(1)), cm = parseInt(data.Cm.substr(1)), type = data.CPType || 0;
                return (_cm << 28) | mask | (data.CPOpc << 21) | (l << 20) | (cn << 16) |
                    (rd << 12) | (data.CP << 8) | (type << 5) | cm;
            };
            Assembler.prototype.BuildInstruction_15 = function (data) {
                if (data.Mnemonic == 'PUSH')
                    data.Mnemonic = 'STM';
                else
                    data.Mnemonic = 'LDM';
                return this.BuildInstruction_9(data);
            };
            Assembler.prototype.BuildInstruction_16 = function (data) {
                data['ShiftOp'] = data.Mnemonic;
                data.Mnemonic = 'MOV';
                return this.BuildInstruction_2(data);
            };
            Assembler.prototype.BuildInstruction_17 = function (data) {
                data.Rrx = true;
                data.Mnemonic = 'MOV';
                return this.BuildInstruction_2(data);
            };
            Assembler.prototype.BuildInstruction_18 = function (data) {
                return this.BuildInstruction_2({
                    Mnemonic: 'MOV',
                    Rd: 'R0',
                    Op2: 'R0'
                });
            };
            Assembler.prototype.BuildInstruction_19 = function (data) {
                var opcodes = { 'TST': 8, 'TEQ': 9, 'CMP': 10, 'CMN': 11 }, cm = this.ConditionMask(data.Condition), s = 1, i = data.Immediate ? 1 : 0, rn = parseInt(data.Rn.substr(1)), rd = 0, op2;
                if (i) {
                    op2 = (data.Op2.Rotate << 8) | data.Op2.Immediate;
                }
                else {
                    var stypes = { 'LSL': 0, 'LSR': 1, 'ASL': 0, 'ASR': 2, 'ROR': 3 };
                    var sf = 0;
                    if (data.Shift && data.ShiftOp) {
                        var st = stypes[data.ShiftOp];
                        if (Assembler_1.Util.IsRegister(data.Shift))
                            sf = (parseInt(data.Shift.substr(1)) << 4) | (st << 1) | (1);
                        else
                            sf = (data.Shift << 3) | (st << 1);
                    }
                    op2 = (sf << 4) | parseInt(data.Op2.substr(1));
                }
                var opc = opcodes[data.Mnemonic];
                return (cm << 28) | (i << 25) | (opc << 21) | (s << 20) | (rn << 16) |
                    (rd << 12) | op2;
            };
            return Assembler;
        }());
        Assembler_1.Assembler = Assembler;
    })(Assembler = ARM.Assembler || (ARM.Assembler = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        (function (Condition) {
            Condition[Condition["EQ"] = 0] = "EQ";
            Condition[Condition["NE"] = 1] = "NE";
            Condition[Condition["CS"] = 2] = "CS";
            Condition[Condition["CC"] = 3] = "CC";
            Condition[Condition["MI"] = 4] = "MI";
            Condition[Condition["PL"] = 5] = "PL";
            Condition[Condition["VS"] = 6] = "VS";
            Condition[Condition["VC"] = 7] = "VC";
            Condition[Condition["HI"] = 8] = "HI";
            Condition[Condition["LS"] = 9] = "LS";
            Condition[Condition["GE"] = 10] = "GE";
            Condition[Condition["LT"] = 11] = "LT";
            Condition[Condition["GT"] = 12] = "GT";
            Condition[Condition["LE"] = 13] = "LE";
            Condition[Condition["AL"] = 14] = "AL";
            Condition[Condition["NV"] = 15] = "NV";
        })(Simulator.Condition || (Simulator.Condition = {}));
        var Condition = Simulator.Condition;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Cpsr = (function () {
            function Cpsr() {
                this.Mode = Simulator.CpuMode.Supervisor;
                this.I = this.F = true;
            }
            Cpsr.prototype.ToWord = function () {
                var _n = this.N ? 1 : 0, _z = this.Z ? 1 : 0, _c = this.C ? 1 : 0, _v = this.V ? 1 : 0, _i = this.I ? 1 : 0, _f = this.F ? 1 : 0, _t = this.T ? 1 : 0;
                return ((_n << 31) | (_z << 30) | (_c << 29) | (_v << 28) |
                    (_i << 7) | (_f << 6) | (_t << 5) | this.Mode).toUint32();
            };
            Cpsr.FromWord = function (word) {
                var r = new Cpsr();
                r.N = ((word >> 31) & 0x01) ? true : false;
                r.Z = ((word >> 30) & 0x01) ? true : false;
                r.C = ((word >> 29) & 0x01) ? true : false;
                r.V = ((word >> 28) & 0x01) ? true : false;
                r.I = ((word >> 7) & 0x01) ? true : false;
                r.F = ((word >> 6) & 0x01) ? true : false;
                r.T = ((word >> 5) & 0x01) ? true : false;
                r.Mode = word & 0x1F;
                return r;
            };
            Cpsr.FromPsr = function (psr) {
                var r = new Cpsr();
                r.N = psr.N;
                r.Z = psr.Z;
                r.C = psr.C;
                r.V = psr.V;
                r.I = psr.I;
                r.F = psr.F;
                r.T = psr.T;
                r.Mode = psr.Mode;
                return r;
            };
            return Cpsr;
        }());
        Simulator.Cpsr = Cpsr;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        (function (CpuException) {
            CpuException[CpuException["Reset"] = 0] = "Reset";
            CpuException[CpuException["Undefined"] = 4] = "Undefined";
            CpuException[CpuException["Software"] = 8] = "Software";
            CpuException[CpuException["Prefetch"] = 12] = "Prefetch";
            CpuException[CpuException["Data"] = 16] = "Data";
            CpuException[CpuException["IRQ"] = 24] = "IRQ";
            CpuException[CpuException["FIQ"] = 28] = "FIQ";
        })(Simulator.CpuException || (Simulator.CpuException = {}));
        var CpuException = Simulator.CpuException;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        (function (CpuMode) {
            CpuMode[CpuMode["User"] = 16] = "User";
            CpuMode[CpuMode["FIQ"] = 17] = "FIQ";
            CpuMode[CpuMode["IRQ"] = 18] = "IRQ";
            CpuMode[CpuMode["Supervisor"] = 19] = "Supervisor";
            CpuMode[CpuMode["Abort"] = 23] = "Abort";
            CpuMode[CpuMode["System"] = 31] = "System";
            CpuMode[CpuMode["Undefined"] = 27] = "Undefined";
        })(Simulator.CpuMode || (Simulator.CpuMode = {}));
        var CpuMode = Simulator.CpuMode;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        (function (CpuState) {
            CpuState[CpuState["ARM"] = 0] = "ARM";
            CpuState[CpuState["Thumb"] = 1] = "Thumb";
        })(Simulator.CpuState || (Simulator.CpuState = {}));
        var CpuState = Simulator.CpuState;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        (function (DataType) {
            DataType[DataType["Byte"] = 0] = "Byte";
            DataType[DataType["Halfword"] = 1] = "Halfword";
            DataType[DataType["Word"] = 2] = "Word";
        })(Simulator.DataType || (Simulator.DataType = {}));
        var DataType = Simulator.DataType;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Util = (function () {
            function Util() {
            }
            Util.SignExtend = function (v, f, t) {
                var msb = f - 1;
                if (v & (1 << msb)) {
                    for (var i = 1 + msb; i < t; i++)
                        v |= (1 << i);
                }
                return v;
            };
            Util.RotateRight = function (v, n) {
                for (var i = 0; i < n; i++)
                    v = (v >>> 1) | ((v & 0x01) << 31);
                return v;
            };
            Util.CountBits = function (v) {
                var c = 0;
                for (var i = 0; i < 32; i++) {
                    if (v & (1 << i))
                        c++;
                }
                return c;
            };
            return Util;
        }());
        Simulator.Util = Util;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
Number.prototype.toUint32 = function () {
    return this >>> 0;
};
Number.prototype.toInt32 = function () {
    return this | 0;
};
Number.prototype.toHex = function (pad) {
    var p = pad || 8;
    return "0x" + (Array(p + 1).join('0') + this.toString(16)).substr(-p);
};
Number.prototype.msb = function () {
    return (this >>> 31) == 1;
};
Math.add64 = function (a, b) {
    var rh = a.hi + b.hi, rl = a.lo + b.lo;
    if (rl > 0xffffffff)
        rh = rh + 1;
    return { hi: rh.toUint32(), lo: rl.toUint32() };
};
Math.umul64 = function (a, b) {
    var ah = (a >>> 16), al = a & 0xffff, bh = (b >>> 16), bl = b & 0xffff, rh = (ah * bh), rl = (al * bl), rm1 = ah * bl, rm2 = al * bh, rm1h = rm1 >>> 16, rm2h = rm2 >>> 16, rm1l = rm1 & 0xffff, rm2l = rm2 & 0xffff, rmh = rm1h + rm2h, rml = rm1l + rm2l;
    if (rl > (rl + (rml << 16)).toUint32())
        rmh = rmh + 1;
    rl = (rl + (rml << 16)).toUint32();
    rh = rh + rmh;
    if (rml & 0xffff0000)
        rh = rh + 1;
    return { hi: rh, lo: rl };
};
Math.smul64 = function (a, b) {
    var neg = ((a & 0x80000000) ^ (b & 0x80000000)) ? 1 : 0, _a = (a & 0x80000000) ? (1 + (~a)).toUint32() : a.toUint32(), _b = (b & 0x80000000) ? (1 + (~b)).toUint32() : b.toUint32(), _c = Math.umul64(_a, _b);
    if (neg) {
        var carry = 0;
        _c.lo = (~_c.lo).toUint32();
        if (_c.lo > (_c.lo + 1).toUint32())
            carry = 1;
        _c.lo = (_c.lo + 1).toUint32();
        _c.hi = ((~_c.hi).toUint32() + carry).toUint32();
    }
    return { hi: _c.hi, lo: _c.lo };
};
;
Array.prototype.remove = function (element) {
    var index = this.indexOf(element);
    if (index < 0)
        return false;
    this.splice(index, 1);
    return true;
};
Array.prototype.insert = function (element, comparer) {
    function locationOf(element, array, comparer, start, end) {
        if (array.length === 0)
            return -1;
        start = start || 0;
        end = end || array.length;
        var pivot = (start + end) >> 1, c = comparer(element, array[pivot]);
        if (end - start <= 1)
            return c == -1 ? pivot - 1 : pivot;
        switch (c) {
            case -1:
                return locationOf(element, array, comparer, start, pivot);
            case 0:
                return pivot;
            case 1:
                return locationOf(element, array, comparer, pivot, end);
        }
        ;
    }
    ;
    var index = locationOf(element, this, comparer) + 1;
    this.splice(index, 0, element);
    return index;
};
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Cpu = (function () {
            function Cpu(clockRate, read, write) {
                this.cpsr = new Simulator.Cpsr();
                this.gpr = new Array(0x10);
                this.cycles = 0;
                this.instructions = 0;
                this._nFIQ = true;
                this._nIRQ = true;
                this.banked = {
                    0x10: { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0 },
                    0x11: { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, spsr: 0 },
                    0x12: { 13: 0, 14: 0, spsr: 0 },
                    0x13: { 13: 0, 14: 0, spsr: 0 },
                    0x17: { 13: 0, 14: 0, spsr: 0 },
                    0x1B: { 13: 0, 14: 0, spsr: 0 }
                };
                this.clockRate = clockRate * 1000000;
                this.Read = read;
                this.Write = write;
                for (var i = 0; i < this.gpr.length; i++)
                    this.gpr[i] = 0;
                this.RaiseException(Simulator.CpuException.Reset);
            }
            Object.defineProperty(Cpu.prototype, "privileged", {
                get: function () {
                    return this.cpsr.Mode != Simulator.CpuMode.User;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Cpu.prototype, "spsr", {
                get: function () {
                    return this.banked[this.mode]['spsr'];
                },
                set: function (v) {
                    if (this.mode == Simulator.CpuMode.User || this.mode == Simulator.CpuMode.System)
                        return;
                    this.banked[this.mode]['spsr'] = v;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Cpu.prototype, "pc", {
                get: function () {
                    return this.gpr[15];
                },
                set: function (v) {
                    if (v % 4)
                        throw new Error("Unaligned memory address " + v.toHex());
                    this.gpr[15] = v;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Cpu.prototype, "lr", {
                get: function () {
                    return this.gpr[14];
                },
                set: function (v) {
                    this.gpr[14] = v;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Cpu.prototype, "state", {
                get: function () {
                    return this.cpsr.T ? Simulator.CpuState.Thumb : Simulator.CpuState.ARM;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Cpu.prototype, "ClockRate", {
                get: function () {
                    return this.clockRate;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Cpu.prototype, "Cycles", {
                get: function () {
                    return this.cycles;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Cpu.prototype, "Instructions", {
                get: function () {
                    return this.instructions;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Cpu.prototype, "nFIQ", {
                get: function () {
                    return this._nFIQ;
                },
                set: function (v) {
                    this._nFIQ = v;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Cpu.prototype, "nIRQ", {
                get: function () {
                    return this._nIRQ;
                },
                set: function (v) {
                    this._nIRQ = v;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Cpu.prototype, "mode", {
                get: function () {
                    return this.cpsr.Mode;
                },
                enumerable: true,
                configurable: true
            });
            Cpu.prototype.Step = function () {
                return -1 * (this.Run(1) - 1);
            };
            Cpu.prototype.Run = function (cycles) {
                while (cycles > 0) {
                    var iw = this.Read(this.pc, Simulator.DataType.Word);
                    var cond = (iw >> 28) & 0xF;
                    if (this.CheckCondition(cond)) {
                        var exec = cond == Simulator.Condition.NV ? this.undefined : this.Decode(iw);
                        this.pc = this.pc + 8;
                        var beforeInstruction = this.pc;
                        var instCycles = exec.call(this, iw);
                        this.cycles = this.cycles + instCycles;
                        cycles = cycles - instCycles;
                        this.instructions++;
                        if (this.pc == beforeInstruction && exec != this.bx && exec != this.b_bl)
                            this.pc = this.pc - 4;
                    }
                    else {
                        this.pc = this.pc + 4;
                        cycles--;
                    }
                    if (!this.nFIQ && !this.cpsr.F) {
                        this.RaiseException(Simulator.CpuException.FIQ);
                    }
                    else if (!this.nIRQ && !this.cpsr.I) {
                        this.RaiseException(Simulator.CpuException.IRQ);
                    }
                }
                return cycles;
            };
            Cpu.prototype.GetRegs = function () {
                return {
                    Gpr: this.gpr.slice(0),
                    Cpsr: this.cpsr.ToWord()
                };
            };
            Cpu.prototype.CheckCondition = function (c) {
                switch (c) {
                    case Simulator.Condition.EQ: return this.cpsr.Z;
                    case Simulator.Condition.NE: return !this.cpsr.Z;
                    case Simulator.Condition.CS: return this.cpsr.C;
                    case Simulator.Condition.CC: return !this.cpsr.C;
                    case Simulator.Condition.MI: return this.cpsr.N;
                    case Simulator.Condition.PL: return !this.cpsr.N;
                    case Simulator.Condition.VS: return this.cpsr.V;
                    case Simulator.Condition.VC: return !this.cpsr.V;
                    case Simulator.Condition.HI: return !this.cpsr.Z && this.cpsr.C;
                    case Simulator.Condition.LS: return !this.cpsr.C || this.cpsr.Z;
                    case Simulator.Condition.GE: return this.cpsr.N == this.cpsr.V;
                    case Simulator.Condition.LT: return this.cpsr.N != this.cpsr.V;
                    case Simulator.Condition.GT: return !this.cpsr.Z && (this.cpsr.N == this.cpsr.V);
                    case Simulator.Condition.LE: return this.cpsr.Z || (this.cpsr.N != this.cpsr.V);
                    case Simulator.Condition.AL: return true;
                    default:
                        return true;
                }
            };
            Cpu.prototype.LoadCpsr = function (value) {
                var newCpsr = Simulator.Cpsr.FromWord(value);
                if (newCpsr.T)
                    throw new Error('THUMB mode is not supported.');
                var curBank = this.mode == Simulator.CpuMode.System ? Simulator.CpuMode.User : this.mode;
                var newBank = newCpsr.Mode == Simulator.CpuMode.System ? Simulator.CpuMode.User : newCpsr.Mode;
                if (curBank != newBank) {
                    var o = this.banked[curBank];
                    var n = this.banked[newBank];
                    for (var r in n) {
                        if (r == 'spsr') {
                            n[r] = this.cpsr.ToWord();
                            continue;
                        }
                        if (typeof o[r] != 'undefined')
                            o[r] = this.gpr[r];
                        this.gpr[r] = n[r];
                    }
                }
                this.cpsr = newCpsr;
            };
            Cpu.prototype.RaiseException = function (e) {
                var mode = [Simulator.CpuMode.Supervisor, Simulator.CpuMode.Undefined, Simulator.CpuMode.Supervisor, Simulator.CpuMode.Abort,
                    Simulator.CpuMode.Abort, null, Simulator.CpuMode.IRQ, Simulator.CpuMode.FIQ][e / 4];
                var newCpsr = Simulator.Cpsr.FromPsr(this.cpsr);
                newCpsr.Mode = mode;
                newCpsr.I = true;
                if (e == Simulator.CpuException.Reset || e == Simulator.CpuException.FIQ)
                    newCpsr.F = true;
                newCpsr.T = false;
                this.LoadCpsr(newCpsr.ToWord());
                if (e != Simulator.CpuException.Reset)
                    this.lr = e == Simulator.CpuException.Data ? this.pc : (this.pc - 4);
                this.pc = e;
            };
            Cpu.prototype.Decode = function (iw) {
                switch ((iw >> 25) & 0x07) {
                    case 0:
                        if (!(((iw >> 4) & 0x1FFFFF) ^ 0x12FFF1))
                            return this.bx;
                        var b74 = (iw >> 4) & 0xF;
                        if (b74 == 9)
                            return ((iw >> 24) & 0x01) ? this.swi :
                                (((iw >> 23) & 0x01) ? this.mull_mlal : this.mul_mla);
                        if (b74 == 0xB || b74 == 0xD || b74 == 0xF)
                            return this.ldrh_strh_ldrsb_ldrsh;
                        if (((iw >> 23) & 0x03) == 2 && !((iw >> 20) & 0x01))
                            return ((iw >> 21) & 0x01) ? this.msr : this.mrs;
                        return this.data;
                    case 1:
                        if (((iw >> 23) & 0x03) == 2 && !((iw >> 20) & 0x01))
                            return ((iw >> 21) & 0x01) ? this.msr : this.mrs;
                        return this.data;
                    case 2: return this.ldr_str;
                    case 3: return ((iw >> 4) & 0x01) ? this.undefined : this.ldr_str;
                    case 4: return this.ldm_stm;
                    case 5: return this.b_bl;
                    case 6: return this.ldc_stc;
                    case 7:
                        if ((iw >> 24) & 0x01)
                            return this.swi;
                        return ((iw >> 4) & 0x01) ? this.mrc_mcr : this.cdp;
                }
            };
            Cpu.prototype.GetMultiplyCycles = function (m) {
                var u = m.toUint32();
                if (u < 0xFF)
                    return 1;
                if (u < 0xFFFF)
                    return 2;
                if (u < 0xFFFFFF)
                    return 3;
                return 4;
            };
            Cpu.prototype.bx = function (iw) {
                var addr = this.gpr[iw & 0xF];
                if (addr & 0x01)
                    throw new Error('THUMB mode is not supported.');
                this.pc = addr;
                return 3;
            };
            Cpu.prototype.b_bl = function (iw) {
                var offset = Simulator.Util.SignExtend((iw & 0xFFFFFF) << 2, 26, 32);
                if ((iw >> 24) & 0x01)
                    this.gpr[14] = this.pc - 4;
                this.pc = this.pc + offset;
                return 3;
            };
            Cpu.prototype.swi = function (iw) {
                this.RaiseException(Simulator.CpuException.Software);
                return 3;
            };
            Cpu.prototype.mrs = function (iw) {
                var p = (iw >> 22) & 0x1, rd = (iw >> 12) & 0xF;
                if (p) {
                    if (this.spsr)
                        this.gpr[rd] = this.spsr;
                }
                else {
                    this.gpr[rd] = this.cpsr.ToWord();
                }
                return 1;
            };
            Cpu.prototype.msr = function (iw) {
                var i = (iw >> 25) & 0x1, p = (iw >> 22) & 0x1, a = (iw >> 16) & 0x1, v = this.gpr[iw & 0xF], cy = 1;
                if (i) {
                    var imm = iw & 0xFF, rot = ((iw >> 8) & 0xF) * 2;
                    v = Simulator.Util.RotateRight(imm, rot);
                    cy = cy + 1;
                }
                if (!this.privileged)
                    a = 0;
                if (p && this.spsr) {
                    if (a == 0) {
                        var t = this.spsr;
                        t &= ~0xF0000000;
                        t |= (v & 0xF0000000);
                        v = t;
                    }
                    this.spsr = v;
                }
                else {
                    if (a == 0) {
                        var z = this.cpsr.ToWord();
                        z &= ~0xF0000000;
                        z |= (v & 0xF0000000);
                        v = z;
                    }
                    this.LoadCpsr(v);
                }
                return cy;
            };
            Cpu.prototype.swp = function (iw) {
                var b = (iw >> 22) & 0x1, rn = (iw >> 16) & 0xF, rd = (iw >> 12) & 0xF, rm = iw & 0xF, cy = 2, dt = b == 1 ? Simulator.DataType.Byte : Simulator.DataType.Word;
                try {
                    var c = this.Read(this.gpr[rn], dt);
                    cy++;
                    this.Write(this.gpr[rn], dt, this.gpr[rm]);
                    cy++;
                    this.gpr[rd] = c;
                }
                catch (e) {
                    if (e.message == 'BadAddress')
                        this.RaiseException(Simulator.CpuException.Data);
                    else
                        throw e;
                }
                return cy;
            };
            Cpu.prototype.cdp = function (iw) {
                var opc = (iw >> 20) & 0xF, cRn = (iw >> 16) & 0xF, cRd = (iw >> 12) & 0xF, cNo = (iw >> 8) & 0xF, cp = (iw >> 5) & 0x7, cRm = iw & 0xF;
                this.RaiseException(Simulator.CpuException.Undefined);
                return 1;
            };
            Cpu.prototype.data = function (iw) {
                var ops = {
                    0: this.and, 1: this.eor, 2: this.sub, 3: this.rsb, 4: this.add,
                    5: this.adc, 6: this.sbc, 7: this.rsc, 8: this.tst, 9: this.teq,
                    10: this.cmp, 11: this.cmn, 12: this.orr, 13: this.mov,
                    14: this.bic, 15: this.mvn
                }, opc = (iw >> 21) & 0xF, s = (iw >> 20) & 0x1, i = (iw >> 25) & 0x1, rn = (iw >> 16) & 0xF, rd = (iw >> 12) & 0xF, op2 = 0, cy = rd == 15 ? 2 : 1;
                if (i) {
                    op2 = Simulator.Util.RotateRight(iw & 0xFF, ((iw >> 8) & 0xF) * 2);
                }
                else {
                    var rm = iw & 0xF, sh = (iw >> 4) & 0xFF, sOp = (sh >> 1) & 0x03, amt = 0, sCOut = false;
                    if (sh & 0x01) {
                        amt = this.gpr[(sh >> 4) & 0xF] & 0xF;
                        cy = cy + 1;
                    }
                    else {
                        amt = (sh >> 3) & 0x1F;
                    }
                    switch (sOp) {
                        case 0:
                            op2 = this.gpr[rm] << amt;
                            sCOut = amt ? (((this.gpr[rm] >> (32 - amt)) & 0x01) == 1) : this.cpsr.C;
                            break;
                        case 1:
                            if (!amt)
                                amt = 32;
                            op2 = this.gpr[rm] >>> amt;
                            sCOut = ((this.gpr[rm] >>> (amt - 1)) & 0x01) == 1;
                            break;
                        case 2:
                            if (!amt)
                                amt = 32;
                            op2 = this.gpr[rm] >> amt;
                            sCOut = ((this.gpr[rm] >>> (amt - 1)) & 0x01) == 1;
                            break;
                        case 3:
                            if (!amt) {
                                op2 = ((this.cpsr.C ? 1 : 0) << 31) | (this.gpr[rm] >>> 1);
                                sCOut = (this.gpr[rm] & 0x01) == 1;
                            }
                            else {
                                op2 = Simulator.Util.RotateRight(this.gpr[rm], amt);
                                sCOut = ((this.gpr[rm] >>> (amt - 1)) & 0x01) == 1;
                            }
                            break;
                    }
                    var logicalOps = { 0: 1, 1: 1, 8: 1, 9: 1, 12: 1, 13: 1, 14: 1, 15: 1 };
                    if (s == 1 && logicalOps[opc])
                        this.cpsr.C = sCOut;
                }
                ops[opc].call(this, this.gpr[rn], op2, rd, s == 1 && rd != 15);
                var copySpsr = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 12: 1, 13: 1, 14: 1, 15: 1 };
                if (s == 1 && rd == 15 && copySpsr[opc] && this.spsr)
                    this.LoadCpsr(this.spsr);
                return cy;
            };
            Cpu.prototype.and = function (op1, op2, rd, s) {
                this.gpr[rd] = (op1 & op2).toUint32();
                if (s) {
                    this.cpsr.N = this.gpr[rd].msb();
                    this.cpsr.Z = this.gpr[rd] == 0;
                }
            };
            Cpu.prototype.eor = function (op1, op2, rd, s) {
                this.gpr[rd] = (op1 ^ op2).toUint32();
                if (s) {
                    this.cpsr.N = this.gpr[rd].msb();
                    this.cpsr.Z = this.gpr[rd] == 0;
                }
            };
            Cpu.prototype.sub = function (op1, op2, rd, s) {
                this.gpr[rd] = (op1 - op2).toUint32();
                if (s) {
                    this.cpsr.C = this.gpr[rd] <= op1;
                    this.cpsr.V = ((op1 ^ op2) & (op1 ^ this.gpr[rd])).msb();
                    this.cpsr.N = this.gpr[rd].msb();
                    this.cpsr.Z = this.gpr[rd] == 0;
                }
            };
            Cpu.prototype.rsb = function (op1, op2, rd, s) {
                this.sub(op2, op1, rd, s);
            };
            Cpu.prototype.add = function (op1, op2, rd, s) {
                var r = op1.toUint32() + op2.toUint32();
                this.gpr[rd] = r.toUint32();
                if (s) {
                    this.cpsr.C = r > 0xFFFFFFFF;
                    this.cpsr.V = (~(op1 ^ op2) & (op1 ^ this.gpr[rd])).msb();
                    this.cpsr.N = this.gpr[rd].msb();
                    this.cpsr.Z = this.gpr[rd] == 0;
                }
            };
            Cpu.prototype.adc = function (op1, op2, rd, s) {
                var r = op1.toUint32() + op2.toUint32() + (this.cpsr.C ? 1 : 0);
                this.gpr[rd] = r.toUint32();
                if (s) {
                    this.cpsr.C = r > 0xFFFFFFFF;
                    this.cpsr.V = (~(op1 ^ op2) & (op1 ^ this.gpr[rd])).msb();
                    this.cpsr.N = this.gpr[rd].msb();
                    this.cpsr.Z = this.gpr[rd] == 0;
                }
            };
            Cpu.prototype.sbc = function (op1, op2, rd, s) {
                this.gpr[rd] = (op1 - op2 - (this.cpsr.C ? 1 : 0)).toUint32();
                if (s) {
                    this.cpsr.C = this.gpr[rd] <= op1;
                    this.cpsr.V = ((op1 ^ op2) & (op1 ^ this.gpr[rd])).msb();
                    this.cpsr.N = this.gpr[rd].msb();
                    this.cpsr.Z = this.gpr[rd] == 0;
                }
            };
            Cpu.prototype.rsc = function (op1, op2, rd, s) {
                this.sbc(op2, op1, rd, s);
            };
            Cpu.prototype.tst = function (op1, op2, rd) {
                var r = (op1 & op2).toUint32();
                this.cpsr.N = r.msb();
                this.cpsr.Z = r == 0;
            };
            Cpu.prototype.teq = function (op1, op2, rd) {
                var r = (op1 ^ op2).toUint32();
                this.cpsr.N = r.msb();
                this.cpsr.Z = r == 0;
            };
            Cpu.prototype.cmp = function (op1, op2, rd) {
                var r = (op1 - op2).toUint32();
                this.cpsr.C = r <= op1;
                this.cpsr.V = ((op1 ^ op2) & (op1 ^ r)).msb();
                this.cpsr.N = r.msb();
                this.cpsr.Z = r == 0;
            };
            Cpu.prototype.cmn = function (op1, op2, rd) {
                var r = op1.toUint32() + op2.toUint32();
                this.cpsr.C = r > 0xFFFFFFFF;
                this.cpsr.V = (~(op1 ^ op2) & (op1 ^ r)).msb();
                this.cpsr.N = r.msb();
                this.cpsr.Z = r == 0;
            };
            Cpu.prototype.orr = function (op1, op2, rd, s) {
                this.gpr[rd] = (op1 | op2).toUint32();
                if (s) {
                    this.cpsr.N = this.gpr[rd].msb();
                    this.cpsr.Z = this.gpr[rd] == 0;
                }
            };
            Cpu.prototype.mov = function (op1, op2, rd, s) {
                this.gpr[rd] = op2.toUint32();
                if (s) {
                    this.cpsr.N = this.gpr[rd].msb();
                    this.cpsr.Z = this.gpr[rd] == 0;
                }
            };
            Cpu.prototype.bic = function (op1, op2, rd, s) {
                this.gpr[rd] = (op1 & (~op2).toUint32()).toUint32();
                if (s) {
                    this.cpsr.N = this.gpr[rd].msb();
                    this.cpsr.Z = this.gpr[rd] == 0;
                }
            };
            Cpu.prototype.mvn = function (op1, op2, rd, s) {
                this.gpr[rd] = (~op2).toUint32();
                if (s) {
                    this.cpsr.N = this.gpr[rd].msb();
                    this.cpsr.Z = this.gpr[rd] == 0;
                }
            };
            Cpu.prototype.ldr_str = function (iw) {
                var i = (iw >> 25) & 0x1, p = (iw >> 24) & 0x1, u = (iw >> 23) & 0x1, b = (iw >> 22) & 0x1, w = (iw >> 21) & 0x1, l = (iw >> 20) & 0x1, rn = (iw >> 16) & 0xF, rd = (iw >> 12) & 0xF, cy = l ? ((rd == 15) ? 5 : 3) : 2, ofs = 0;
                if (i == 0) {
                    ofs = iw & 0xFFF;
                }
                else {
                    var rm = iw & 0xF;
                    var sh = (iw >> 4) & 0xFF;
                    var sOp = (sh >> 1) & 0x03;
                    var amt = (sh >> 3) & 0x1F;
                    switch (sOp) {
                        case 0:
                            ofs = this.gpr[rm] << amt;
                            break;
                        case 1:
                            ofs = this.gpr[rm] >>> ((amt != 0) ? amt : 32);
                            break;
                        case 2:
                            ofs = this.gpr[rm] >> ((amt != 0) ? amt : 32);
                            break;
                        case 3:
                            if (!amt)
                                ofs = ((this.cpsr.C ? 1 : 0) << 31) | (this.gpr[rm] >>> 1);
                            else
                                ofs = Simulator.Util.RotateRight(this.gpr[rm], amt);
                            break;
                    }
                }
                if (!u)
                    ofs = (-1) * ofs;
                var addr = this.gpr[rn] + (p ? ofs : 0);
                try {
                    if (l)
                        this.gpr[rd] = this.Read(addr, b ? Simulator.DataType.Byte : Simulator.DataType.Word);
                    else
                        this.Write(addr, b ? Simulator.DataType.Byte : Simulator.DataType.Word, this.gpr[rd]);
                }
                catch (e) {
                    if (e.message == 'BadAddress') {
                        this.RaiseException(Simulator.CpuException.Data);
                        return cy;
                    }
                    throw e;
                }
                if (p == 0)
                    addr = addr + ofs;
                if (w || p == 0)
                    this.gpr[rn] = addr;
                return cy;
            };
            Cpu.prototype.ldm_stm = function (iw) {
                var p = (iw >> 24) & 0x1, u = (iw >> 23) & 0x1, s = (iw >> 22) & 0x1, w = (iw >> 21) & 0x1, l = (iw >> 20) & 0x1, rn = (iw >> 16) & 0xF, rlist = iw & 0xFFFF, cy = l ? ((rlist & 0x8000) ? 4 : 2) : 1, offset = u ? 0 : (-4 * Simulator.Util.CountBits(rlist)), user = false, cpsr = false;
                if (s) {
                    if (!this.spsr)
                        return cy;
                    if (l && (rlist & 0x8000))
                        cpsr = true;
                    else
                        user = true;
                }
                if (offset)
                    p = p ? 0 : 1;
                var addr = this.gpr[rn] + offset;
                for (var i = 0; i < 16; i++) {
                    if (!(rlist & (1 << i)))
                        continue;
                    cy = cy + 1;
                    if (p)
                        addr = addr + 4;
                    try {
                        if (l) {
                            var c = this.Read(addr, Simulator.DataType.Word);
                            if (user && i > 7 && i < 15)
                                this.banked[Simulator.CpuMode.User][i] = c;
                            else
                                this.gpr[i] = c;
                        }
                        else {
                            if (user && i > 7 && i < 15) {
                                this.Write(addr, Simulator.DataType.Word, this.banked[Simulator.CpuMode.User][i]);
                            }
                            else {
                                this.Write(addr, Simulator.DataType.Word, this.gpr[i]);
                            }
                        }
                    }
                    catch (e) {
                        if (e.message == 'BadAddress') {
                            this.RaiseException(Simulator.CpuException.Data);
                            return cy;
                        }
                        throw e;
                    }
                    if (!p)
                        addr = addr + 4;
                }
                if (w)
                    this.gpr[rn] = addr + offset;
                if (cpsr)
                    this.LoadCpsr(this.spsr);
                return cy;
            };
            Cpu.prototype.ldc_stc = function (iw) {
                var p = (iw >> 24) & 0x1, u = (iw >> 23) & 0x1, n = (iw >> 22) & 0x1, w = (iw >> 21) & 0x1, l = (iw >> 20) & 0x1, rn = (iw >> 16) & 0xF, cRd = (iw >> 12) & 0xF, cNo = (iw >> 8) & 0xF, ofs = iw & 0xFF;
                this.RaiseException(Simulator.CpuException.Undefined);
                return 2;
            };
            Cpu.prototype.mrc_mcr = function (iw) {
                var opc = (iw >> 21) & 0x7, l = (iw >> 20) & 0x1, cRn = (iw >> 16) & 0xF, rd = (iw >> 12) & 0xF, cNo = (iw >> 8) & 0xF, cp = (iw >> 5) & 0x7, cRm = iw & 0xF;
                this.RaiseException(Simulator.CpuException.Undefined);
                return 2;
            };
            Cpu.prototype.mul_mla = function (iw) {
                var a = (iw >> 21) & 0x1, s = (iw >> 20) & 0x1, rd = (iw >> 16) & 0xF, rn = (iw >> 12) & 0xF, rs = (iw >> 8) & 0xF, rm = iw & 0xF, cy = (a ? 2 : 1) + this.GetMultiplyCycles(rs);
                this.gpr[rd] = (this.gpr[rm] * this.gpr[rs]).toUint32();
                if (a)
                    this.gpr[rd] = (this.gpr[rd] + this.gpr[rn]).toUint32();
                if (s) {
                    this.cpsr.N = (this.gpr[rd] >>> 31) == 1;
                    this.cpsr.Z = this.gpr[rd] == 0;
                }
                return cy;
            };
            Cpu.prototype.mull_mlal = function (iw) {
                var u = (iw >> 22) & 0x1, a = (iw >> 21) & 0x1, s = (iw >> 20) & 0x1, rdHi = (iw >> 16) & 0xF, rdLo = (iw >> 12) & 0xF, rs = (iw >> 8) & 0xF, rm = iw & 0xF, cy = (a ? 3 : 2) + this.GetMultiplyCycles(rs), ret = u ? Math.smul64(this.gpr[rs], this.gpr[rm]) :
                    Math.umul64(this.gpr[rs], this.gpr[rm]);
                if (a)
                    ret = Math.add64(ret, { hi: this.gpr[rdHi], lo: this.gpr[rdLo] });
                this.gpr[rdHi] = ret.hi;
                this.gpr[rdLo] = ret.lo;
                if (s) {
                    this.cpsr.N = (this.gpr[rdHi] >>> 31) == 1;
                    this.cpsr.Z = this.gpr[rdHi] == 0 && this.gpr[rdLo] == 0;
                }
                return cy;
            };
            Cpu.prototype.ldrh_strh_ldrsb_ldrsh = function (iw) {
                var p = (iw >> 24) & 0x1, u = (iw >> 23) & 0x1, i = (iw >> 22) & 0x1, w = (iw >> 21) & 0x1, l = (iw >> 20) & 0x1, rn = (iw >> 16) & 0xF, rd = (iw >> 12) & 0xF, s = (iw >> 6) & 0x1, h = (iw >> 5) & 0x1, ofs = i ? (((iw >> 4) & 0xF0) | (iw & 0xF)) : this.gpr[iw & 0x0F], cy = l ? ((rd == 15) ? 5 : 3) : 2;
                if (!u)
                    ofs = (-1) * ofs;
                var addr = this.gpr[rn] + (p ? ofs : 0);
                try {
                    if (l)
                        this.gpr[rd] = this.Read(addr, h ? Simulator.DataType.Halfword : Simulator.DataType.Byte);
                    else
                        this.Write(addr, h ? Simulator.DataType.Halfword : Simulator.DataType.Byte, this.gpr[rd]);
                }
                catch (e) {
                    if (e.message == 'BadAddress') {
                        this.RaiseException(Simulator.CpuException.Data);
                        return cy;
                    }
                    else {
                        throw e;
                    }
                }
                if (s && l)
                    this.gpr[rd] = Simulator.Util.SignExtend(this.gpr[rd], h ? 16 : 8, 32);
                if (p == 0)
                    addr = addr + ofs;
                if (w || p == 0)
                    this.gpr[rn] = addr;
                return cy;
            };
            Cpu.prototype.undefined = function (iw) {
                this.RaiseException(Simulator.CpuException.Undefined);
                return 3;
            };
            return Cpu;
        }());
        Simulator.Cpu = Cpu;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Region = (function () {
            function Region(base, size, read, write, images) {
                this.base = base;
                this.size = size;
                this.read = read || this.BufferRead;
                this.write = write || this.BufferWrite;
                if (!read || !write)
                    this.InitBuffers(size, images);
            }
            Region.Intersect = function (a, b) {
                var a_start = a.base, a_end = a.base + a.size, b_start = b.base, b_end = b.base + b.size;
                if (a_end < b_start || a_start > b_end)
                    return false;
                return true;
            };
            Region.NoRead = function (address, type) {
                throw new Error('BadAddress');
            };
            Region.NoWrite = function (address, type, value) {
                throw new Error('BadAddress');
            };
            Object.defineProperty(Region.prototype, "Base", {
                get: function () {
                    return this.base;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Region.prototype, "Size", {
                get: function () {
                    return this.size;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Region.prototype, "Read", {
                get: function () {
                    return this.read;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Region.prototype, "Write", {
                get: function () {
                    return this.write;
                },
                enumerable: true,
                configurable: true
            });
            Region.prototype.BufferRead = function (address, type) {
                switch (type) {
                    case Simulator.DataType.Byte:
                        return this.u8[address];
                    case Simulator.DataType.Halfword:
                        return this.u16[address / 2];
                    case Simulator.DataType.Word:
                    default:
                        return this.u32[address / 4];
                }
            };
            Region.prototype.BufferWrite = function (address, type, value) {
                switch (type) {
                    case Simulator.DataType.Byte:
                        this.u8[address] = value;
                    case Simulator.DataType.Halfword:
                        this.u16[address / 2] = value;
                    case Simulator.DataType.Word:
                    default:
                        this.u32[address / 4] = value;
                }
            };
            Region.prototype.InitBuffers = function (size, images) {
                this.buffer = new ArrayBuffer(size);
                this.u8 = new Uint8Array(this.buffer);
                this.u16 = new Uint16Array(this.buffer);
                this.u32 = new Uint32Array(this.buffer);
                if (images) {
                    for (var _i = 0, images_1 = images; _i < images_1.length; _i++) {
                        var image = images_1[_i];
                        this.u8.set(image.data, image.offset - this.base);
                    }
                }
            };
            return Region;
        }());
        Simulator.Region = Region;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Memory = (function () {
            function Memory(regions) {
                this.regions = new Array();
                if (regions)
                    this.regions = regions;
            }
            Memory.prototype.Map = function (region) {
                if (this.regions.some(function (v) { return Simulator.Region.Intersect(region, v); }))
                    return false;
                this.regions.push(region);
                return true;
            };
            Memory.prototype.Unmap = function (region) {
                for (var i = 0; i < this.regions.length; i++) {
                    if (region == this.regions[i]) {
                        this.regions.splice(i, 1);
                        return true;
                    }
                }
                return false;
            };
            Memory.prototype.Read = function (address, type) {
                if (type == Simulator.DataType.Word)
                    address = (address & 0xFFFFFFFC).toUint32();
                else if (type == Simulator.DataType.Halfword)
                    address = (address & 0xFFFFFFFE).toUint32();
                for (var i = 0; i < this.regions.length; i++) {
                    var r = this.regions[i];
                    if (address < r.Base || address >= (r.Base + r.Size))
                        continue;
                    var value = r.Read(address - r.Base, type);
                    if (type == Simulator.DataType.Halfword)
                        return value & 0xFFFF;
                    if (type == Simulator.DataType.Byte)
                        return value & 0xFF;
                    return value;
                }
                throw new Error('BadAddress');
            };
            Memory.prototype.Write = function (address, type, value) {
                switch (type) {
                    case Simulator.DataType.Word:
                        address = (address & 0xFFFFFFFC).toUint32();
                        break;
                    case Simulator.DataType.Halfword:
                        address = (address & 0xFFFFFFFE).toUint32();
                        value &= 0xFFFF;
                        break;
                    case Simulator.DataType.Byte:
                        value &= 0xFF;
                        break;
                }
                for (var i = 0; i < this.regions.length; i++) {
                    var r = this.regions[i];
                    if (address < r.Base || address >= (r.Base + r.Size))
                        continue;
                    r.Write(address - r.Base, type, value);
                    return;
                }
                throw new Error('BadAddress');
            };
            return Memory;
        }());
        Simulator.Memory = Memory;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Device = (function () {
            function Device(baseAddress) {
                this.baseAddress = baseAddress;
            }
            return Device;
        }());
        Simulator.Device = Device;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Vm = (function () {
            function Vm(clockRate, regions) {
                var _this = this;
                this.devices = new Array();
                this.callbacks = [];
                this.subscribers = {};
                this.memory = new Simulator.Memory(regions);
                this.cpu = new Simulator.Cpu(clockRate, function (a, t) { return _this.memory.Read(a, t); }, function (a, t, v) { return _this.memory.Write(a, t, v); });
            }
            Object.defineProperty(Vm.prototype, "Cpu", {
                get: function () {
                    return this.cpu;
                },
                enumerable: true,
                configurable: true
            });
            Vm.prototype.Map = function (region) {
                return this.memory.Map(region);
            };
            Vm.prototype.Unmap = function (region) {
                return this.memory.Unmap(region);
            };
            Vm.prototype.RegisterCallback = function (timeout, periodic, callback) {
                var cb = {
                    timeout: timeout,
                    timespan: timeout - this.GetTickCount(),
                    periodic: periodic,
                    fn: callback,
                    skip: false
                };
                this.callbacks.insert(cb, function (a, b) {
                    if (a.timeout > b.timeout)
                        return 1;
                    if (a.timeout < b.timeout)
                        return -1;
                    return 0;
                });
                return cb;
            };
            Vm.prototype.UnregisterCallback = function (handle) {
                handle.skip = true;
                return true;
            };
            Vm.prototype.RegisterDevice = function (device) {
                if (this.devices.indexOf(device) >= 0)
                    return false;
                if (!device.OnRegister(this))
                    return false;
                this.devices.push(device);
                return true;
            };
            Vm.prototype.UnregisterDevice = function (device) {
                if (this.devices.indexOf(device) < 0)
                    return false;
                device.OnUnregister();
                return this.devices.remove(device);
            };
            Vm.prototype.RaiseEvent = function (event, sender, args) {
                if (!this.subscribers.hasOwnProperty(event))
                    return;
                for (var _i = 0, _a = this.subscribers[event]; _i < _a.length; _i++) {
                    var s = _a[_i];
                    s(args, sender);
                }
            };
            Vm.prototype.GetClockRate = function () {
                return this.cpu.ClockRate;
            };
            Vm.prototype.GetCycles = function () {
                return this.cpu.Cycles;
            };
            Vm.prototype.GetTickCount = function () {
                return this.cpu.Cycles / this.cpu.ClockRate;
            };
            Vm.prototype.GetCpuRegs = function () {
                return this.cpu.GetRegs();
            };
            Vm.prototype.ReadMemory = function (address, type) {
                return this.memory.Read(address, type);
            };
            Vm.prototype.RunFor = function (ms) {
                var d = new Date().getTime() + ms;
                while (d > new Date().getTime())
                    this.Run(1000);
            };
            Vm.prototype.Run = function (count) {
                var diff = this.cpu.Run(count);
                var time = this.GetTickCount(), reschedule = [], i = 0;
                for (; i < this.callbacks.length; i++) {
                    var cb = this.callbacks[i];
                    if (cb.skip)
                        continue;
                    if (cb.timeout > time)
                        break;
                    cb.fn();
                    if (cb.periodic)
                        reschedule.push(cb);
                }
                this.callbacks.splice(0, i);
                for (var _i = 0, reschedule_1 = reschedule; _i < reschedule_1.length; _i++) {
                    var e = reschedule_1[_i];
                    this.RegisterCallback(time + e.timespan, true, e.fn);
                }
                return diff;
            };
            Vm.prototype.Step = function () {
                return this.cpu.Step();
            };
            Vm.prototype.on = function (event, fn) {
                if (!this.subscribers.hasOwnProperty(event))
                    this.subscribers[event] = [];
                this.subscribers[event].push(fn);
                return this;
            };
            return Vm;
        }());
        Simulator.Vm = Vm;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Devboard = (function () {
            function Devboard(elfImageOrSections) {
                this.subscribers = {};
                this.buttonPushed = [false, false, false, false, false, false, false, false,
                    false, false];
                if (elfImageOrSections instanceof Array)
                    this.MapElfFile(elfImageOrSections);
                else
                    this.MapSections(elfImageOrSections);
                this.Initialize();
            }
            Devboard.prototype.SerialInput = function (uart, character) {
                switch (uart) {
                    case 0:
                        this.uart0.SerialInput(character);
                        break;
                    case 1:
                        this.uart1.SerialInput(character);
                        break;
                    default:
                        throw new Error("Invalid value " + uart + " for parameter 'uart'");
                }
            };
            Devboard.prototype.PushButton = function (button) {
                if (button < 0 || button >= this.buttonPushed.length)
                    throw new Error("Invalid value " + button + " for parameter 'button'");
                this.buttonPushed[button] = true;
            };
            Devboard.prototype.ReleaseButton = function (button) {
                if (button < 0 || button >= this.buttonPushed.length)
                    throw new Error("Invalid value " + button + " for parameter 'button'");
                this.buttonPushed[button] = false;
            };
            Devboard.prototype.Reset = function () {
                this.Initialize();
            };
            Devboard.prototype.RunFor = function (ms) {
                this.vm.RunFor(ms);
            };
            Devboard.prototype.Run = function (count) {
                this.vm.Run(count);
            };
            Devboard.prototype.Step = function () {
                return this.vm.Step();
            };
            Devboard.prototype.GetCpuRegs = function () {
                return this.vm.GetCpuRegs();
            };
            Devboard.prototype.ReadMemory = function (address, type) {
                return this.vm.ReadMemory(address, type);
            };
            Devboard.prototype.Initialize = function () {
                this.vm = new Simulator.Vm(Devboard.clockRate, [
                    new Simulator.Region(Devboard.romStart, Devboard.romSize, null, Simulator.Region.NoWrite, this.romData),
                    new Simulator.Region(Devboard.ramStart, Devboard.ramSize, null, null, this.ramData)
                ]);
                this.InitDevices();
                this.InitScb();
                this.DelegateEvents();
            };
            Devboard.prototype.InitDevices = function () {
                var _this = this;
                var mm = Devboard.memoryMap, im = Devboard.interruptMap;
                var pic = new Simulator.Devices.PIC(mm.pic, function (active_irq) {
                    _this.vm.Cpu.nIRQ = !active_irq;
                }, function (active_fiq) {
                    _this.vm.Cpu.nFIQ = !active_fiq;
                });
                this.uart0 = new Simulator.Devices.TL16C750(mm.uart0, function (a) {
                    return pic.SetSignal(im.uart0, a);
                });
                this.uart1 = new Simulator.Devices.TL16C750(mm.uart1, function (a) {
                    return pic.SetSignal(im.uart1, a);
                });
                var devices = [
                    pic, this.uart0, this.uart1,
                    new Simulator.Devices.HD44780U(mm.lcd),
                    new Simulator.Devices.Timer(mm.timer0, function (a) { return pic.SetSignal(im.timer0, a); }),
                    new Simulator.Devices.Timer(mm.timer1, function (a) { return pic.SetSignal(im.timer1, a); }),
                    new Simulator.Devices.GPIO(mm.gpio, 2, function (port) { return _this.GpIoRead(port); }, function (p, v, s, c, d) { return _this.GpIoWrite(p, v, s, c, d); }),
                    new Simulator.Devices.DS1307(mm.rtc, new Date()),
                    new Simulator.Devices.Watchdog(mm.watchdog)
                ];
                for (var _i = 0, devices_1 = devices; _i < devices_1.length; _i++) {
                    var device = devices_1[_i];
                    if (!this.vm.RegisterDevice(device))
                        throw new Error("Device registration failed for " + device);
                }
            };
            Devboard.prototype.InitScb = function () {
                var _this = this;
                var region = new Simulator.Region(Devboard.memoryMap.scb, 0x1000, function (a, t) { return _this.ScbRead(a, t); }, function (a, t, v) { return _this.ScbWrite(a, t, v); });
                if (!this.vm.Map(region))
                    throw new Error("Failed mapping SCB into memory at " + Devboard.memoryMap.scb);
            };
            Devboard.prototype.MapElfFile = function (bytes) {
                var elf = new Simulator.Elf.Elf32(bytes);
                this.romData = elf.Segments
                    .filter(function (s) { return s.VirtualAddress < Devboard.ramStart; })
                    .map(function (s) { return { offset: s.VirtualAddress, data: s.Bytes }; });
                this.ramData = elf.Segments
                    .filter(function (s) { return s.VirtualAddress >= Devboard.ramStart; })
                    .map(function (s) { return { offset: s.VirtualAddress, data: s.Bytes }; });
            };
            Devboard.prototype.MapSections = function (sections) {
                var a = [];
                for (var name_2 in sections)
                    a.push(sections[name_2]);
                this.romData = a.filter(function (s) { return s.address < Devboard.ramStart; })
                    .map(function (s) { return { offset: s.address, data: s.data }; });
                this.ramData = a.filter(function (s) { return s.address >= Devboard.ramStart; })
                    .map(function (s) { return { offset: s.address, data: s.data }; });
            };
            Devboard.prototype.DelegateEvents = function () {
                var _this = this;
                var events = [
                    'DS1307.DataWrite', 'DS1307.Tick', 'HD44780U.ClearDisplay',
                    'HD44780U.ReturnHome', 'HD44780U.EntryModeSet', 'HD44780U.DisplayControl',
                    'HD44780U.DisplayShift', 'HD44780U.CursorShift', 'HD44780U.DataWrite',
                    'TL16C750.Data', 'Watchdog.Reset'
                ];
                var _loop_1 = function(e) {
                    this_1.vm.on(e, function (args, sender) {
                        _this.RaiseEvent(e, sender, args);
                    });
                };
                var this_1 = this;
                for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
                    var e = events_1[_i];
                    _loop_1(e);
                }
            };
            Devboard.prototype.GpIoRead = function (port) {
                if (port == 0)
                    return 0;
                var retVal = 0;
                for (var i = 0; i < this.buttonPushed.length; i++)
                    retVal |= (this.buttonPushed[i] ? 1 : 0) << i;
                return retVal;
            };
            Devboard.prototype.GpIoWrite = function (port, value, set, clear, dir) {
                if (port != 0)
                    return;
                var ledOn = [], ledOff = [];
                for (var i = 0; i < 10; i++) {
                    if (((value >>> i) & 0x01) == 0x01)
                        ledOn.push(i);
                    else
                        ledOff.push(i);
                }
                if (set)
                    this.RaiseEvent('LED.On', this, ledOn);
                if (clear)
                    this.RaiseEvent('LED.Off', this, ledOff);
            };
            Devboard.prototype.ScbRead = function (address, type) {
                return 0;
            };
            Devboard.prototype.ScbWrite = function (address, type, value) {
                switch (address) {
                    case 0x00:
                        if ((value & 0x01) == 1)
                            throw 'PowerOffException';
                        break;
                }
            };
            Devboard.prototype.RaiseEvent = function (event, sender, args) {
                if (!this.subscribers.hasOwnProperty(event))
                    return;
                for (var _i = 0, _a = this.subscribers[event]; _i < _a.length; _i++) {
                    var s = _a[_i];
                    s(args, sender);
                }
            };
            Devboard.prototype.on = function (event, fn) {
                if (!this.subscribers.hasOwnProperty(event))
                    this.subscribers[event] = [];
                this.subscribers[event].push(fn);
                return this;
            };
            Devboard.clockRate = 6.9824;
            Devboard.romStart = 0x00000000;
            Devboard.romSize = 0x4000;
            Devboard.ramStart = 0x00040000;
            Devboard.ramSize = 0x8000;
            Devboard.memoryMap = {
                uart0: 0xE0000000,
                uart1: 0xE0004000,
                lcd: 0xE0008000,
                pic: 0xE0010000,
                timer0: 0xE0014000,
                timer1: 0xE0018000,
                gpio: 0xE001C000,
                rtc: 0xE0020000,
                watchdog: 0xE0024000,
                scb: 0xE01FC000
            };
            Devboard.interruptMap = {
                uart0: 0,
                uart1: 1,
                timer0: 2,
                timer1: 3
            };
            return Devboard;
        }());
        Simulator.Devboard = Devboard;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Devices;
        (function (Devices) {
            var DS1307 = (function (_super) {
                __extends(DS1307, _super);
                function DS1307(baseAddress, timeOrMemory) {
                    _super.call(this, baseAddress);
                    this.memory = new Array(DS1307.memSize);
                    this.cbHandle = null;
                    if (Array.isArray(timeOrMemory))
                        this.memory = timeOrMemory;
                    else
                        this.InitializeRTC(timeOrMemory);
                }
                Object.defineProperty(DS1307.prototype, "oscillatorEnabled", {
                    get: function () {
                        return (this.memory[0] & 0x80) == 0;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(DS1307.prototype, "twelveHourMode", {
                    get: function () {
                        return (this.memory[2] & 0x40) == 0x40;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(DS1307.prototype, "postMeridiem", {
                    get: function () {
                        return (this.memory[2] & 0x20) == 0x20;
                    },
                    enumerable: true,
                    configurable: true
                });
                DS1307.prototype.OnRegister = function (service) {
                    var _this = this;
                    this.service = service;
                    this.region = new Simulator.Region(this.baseAddress, DS1307.memSize, function (a, t) { return _this.Read(a, t); }, function (a, t, v) { _this.Write(a, t, v); });
                    if (!service.Map(this.region))
                        return false;
                    this.SetTimer(this.oscillatorEnabled);
                    return true;
                };
                DS1307.prototype.OnUnregister = function () {
                    this.SetTimer(false);
                    if (this.region)
                        this.service.Unmap(this.region);
                    this.region = null;
                };
                DS1307.prototype.Read = function (address, type) {
                    var numBytes = type == Simulator.DataType.Word ? 4 : (type == Simulator.DataType.Halfword ? 2 : 1);
                    var ret = 0;
                    for (var i = 0; i < numBytes; i++) {
                        var offset = (address + i) % DS1307.memSize, value = this.memory[offset];
                        var shift = (numBytes - 1 - i) * 8;
                        ret = ret + ((value << shift) & 0xFF);
                    }
                    return ret;
                };
                DS1307.prototype.Write = function (address, type, value) {
                    var numBytes = type == Simulator.DataType.Word ? 4 : (type == Simulator.DataType.Halfword ? 2 : 1);
                    for (var i = 0; i < numBytes; i++) {
                        var byte = (value >>> (i * 8)) & 0xFF;
                        var offset = (address + i) % DS1307.memSize;
                        this.memory[offset] = byte;
                        if (offset == 0)
                            this.SetTimer((byte >>> 7) == 0);
                    }
                    this.RaiseEvent('DS1307.DataWrite');
                };
                DS1307.prototype.InitializeRTC = function (time) {
                    this.SetTime(time);
                    for (var i = 8; i < DS1307.memSize; i++)
                        this.memory[i] = 0x00;
                    this.memory[0] &= ~(1 << 7);
                };
                DS1307.prototype.SetTime = function (time) {
                    var oscFlag = this.memory[0] & 0x80;
                    var b = this.memory[2] & 0x40;
                    var h = time.getHours();
                    var hours = b | DS1307.ToBCD(h);
                    if (b) {
                        var pm = (h > 11 ? 1 : 0) << 5;
                        if (pm)
                            h = h - 12;
                        if (h == 0)
                            h = 12;
                        hours = b | pm | DS1307.ToBCD(h);
                    }
                    var values = [
                        oscFlag | DS1307.ToBCD(time.getSeconds()),
                        DS1307.ToBCD(time.getMinutes()),
                        hours,
                        time.getDay() + 1,
                        DS1307.ToBCD(time.getDate()),
                        DS1307.ToBCD(time.getMonth() + 1),
                        DS1307.ToBCD(time.getFullYear() % 100)
                    ];
                    for (var i = 0; i < values.length; i++)
                        this.memory[i] = values[i];
                };
                DS1307.prototype.GetTime = function () {
                    var s = DS1307.FromBCD(this.memory[0] & 0x7F);
                    var mask = this.twelveHourMode ? 0x1F : 0x3F;
                    var h = DS1307.FromBCD(this.memory[2] & mask);
                    if (this.twelveHourMode) {
                        if (h == 12)
                            h = 0;
                        if (this.postMeridiem)
                            h = h + 12;
                    }
                    var m = DS1307.FromBCD(this.memory[1]), d = DS1307.FromBCD(this.memory[4]), _m = DS1307.FromBCD(this.memory[5]) - 1, y = DS1307.FromBCD(this.memory[6]) + 2000;
                    return new Date(y, _m, d, h, m, s);
                };
                DS1307.prototype.SetTimer = function (enable) {
                    var _this = this;
                    if (enable) {
                        if (this.cbHandle != null)
                            return;
                        this.cbHandle = this.service.RegisterCallback(1, true, function () {
                            _this.Tick();
                        });
                    }
                    else {
                        if (this.cbHandle == null)
                            return;
                        this.service.UnregisterCallback(this.cbHandle);
                        this.cbHandle = null;
                    }
                };
                DS1307.prototype.Tick = function () {
                    var newTime = new Date(this.GetTime().getTime() + 1000);
                    this.SetTime(newTime);
                    this.RaiseEvent('DS1307.Tick');
                };
                DS1307.prototype.RaiseEvent = function (event, opts) {
                    var args = {
                        memory: this.memory
                    };
                    if (opts != null) {
                        for (var key in opts) {
                            if (!opts.hasOwnProperty(key))
                                continue;
                            args[key] = opts[key];
                        }
                    }
                    this.service.RaiseEvent(event, this, args);
                };
                DS1307.ToBCD = function (n) {
                    return (((n / 10) << 4) | (n % 10)) & 0xFF;
                };
                DS1307.FromBCD = function (n) {
                    return ((n >> 4) & 0x0F) * 10 + (n & 0x0F);
                };
                DS1307.memSize = 0x40;
                return DS1307;
            }(Simulator.Device));
            Devices.DS1307 = DS1307;
        })(Devices = Simulator.Devices || (Simulator.Devices = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Devices;
        (function (Devices) {
            var GPIO = (function (_super) {
                __extends(GPIO, _super);
                function GPIO(baseAddress, numPorts, onRead, onWrite) {
                    _super.call(this, baseAddress);
                    this.dir = new Array();
                    this.numPorts = numPorts;
                    this.onRead = onRead;
                    this.onWrite = onWrite;
                    for (var i = 0; i < numPorts; i++)
                        this.dir.push(0);
                }
                GPIO.prototype.OnRegister = function (service) {
                    var _this = this;
                    var memSize = this.numPorts * GPIO.regSizePerPort;
                    this.service = service;
                    this.region = new Simulator.Region(this.baseAddress, memSize, function (a, t) { return _this.Read(a, t); }, function (a, t, v) { _this.Write(a, t, v); });
                    if (!service.Map(this.region))
                        return false;
                    return true;
                };
                GPIO.prototype.OnUnregister = function () {
                    if (this.region)
                        this.service.Unmap(this.region);
                    this.region = null;
                };
                GPIO.prototype.Read = function (address, type) {
                    var port = (address / GPIO.regSizePerPort) | 0;
                    var reg = address % GPIO.regSizePerPort;
                    switch (reg) {
                        case 0x00:
                            return this.onRead(port);
                        case 0x04:
                            return this.dir[port] >>> 0;
                        case 0x08:
                        case 0x0C:
                        default:
                            return 0;
                    }
                };
                GPIO.prototype.Write = function (address, type, value) {
                    var port = (address / GPIO.regSizePerPort) | 0;
                    var reg = address % GPIO.regSizePerPort;
                    var dir = this.dir[port] >>> 0;
                    switch (reg) {
                        case 0x00:
                            this.onWrite(port, value, true, true, dir);
                            break;
                        case 0x04:
                            this.dir[port] = value;
                            break;
                        case 0x08:
                            this.onWrite(port, value, true, false, dir);
                            break;
                        case 0x0C:
                            this.onWrite(port, ~value, false, true, dir);
                            break;
                    }
                };
                GPIO.prototype.RaiseEvent = function (event, opts) {
                    var args = {};
                    if (opts != null) {
                        for (var key in opts) {
                            if (!opts.hasOwnProperty(key))
                                continue;
                            args[key] = opts[key];
                        }
                    }
                    this.service.RaiseEvent(event, this, args);
                };
                GPIO.regSizePerPort = 0x10;
                return GPIO;
            }(Simulator.Device));
            Devices.GPIO = GPIO;
        })(Devices = Simulator.Devices || (Simulator.Devices = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Devices;
        (function (Devices) {
            var HD44780U = (function (_super) {
                __extends(HD44780U, _super);
                function HD44780U(baseAddress, useA00Rom) {
                    if (useA00Rom === void 0) { useA00Rom = false; }
                    _super.call(this, baseAddress);
                    this._db = 0;
                    this.rs = false;
                    this.rw = false;
                    this.e = false;
                    this.busy = false;
                    this.cbHandle = null;
                    this.ddRam = new Array(80);
                    this.ac = 0;
                    this.shiftDisplay = false;
                    this.incrementAc = true;
                    this.displayEnabled = false;
                    this.showCursor = false;
                    this.cursorBlink = false;
                    this.nibbleMode = false;
                    this.secondDisplayLine = false;
                    this.largeFont = false;
                    this.cgRamContext = false;
                    this.latched = false;
                    this.characterRom = useA00Rom ? HD44780U.characterRomA00 : HD44780U.characterRomA02;
                    for (var i = 0; i < this.ddRam.length; i++)
                        this.ddRam[i] = 0x20;
                }
                Object.defineProperty(HD44780U.prototype, "ioctl", {
                    get: function () {
                        return (this.rs ? 1 : 0) + (this.rw ? 2 : 0) + (this.e ? 4 : 0);
                    },
                    set: function (v) {
                        this.rs = (v & 0x01) == 0x01;
                        this.rw = (v & 0x02) == 0x02;
                        var old = this.e;
                        this.e = (v & 0x04) == 0x04;
                        if (old && !this.e && (!this.nibbleMode || !this.latched))
                            this.Exec();
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(HD44780U.prototype, "db", {
                    get: function () {
                        return this._db;
                    },
                    set: function (v) {
                        this._db = v;
                    },
                    enumerable: true,
                    configurable: true
                });
                HD44780U.prototype.OnRegister = function (service) {
                    var _this = this;
                    this.service = service;
                    this.region = new Simulator.Region(this.baseAddress, 0x100, function (a, t) { return _this.Read(a, t); }, function (a, t, v) { _this.Write(a, t, v); });
                    if (!service.Map(this.region))
                        return false;
                    return true;
                };
                HD44780U.prototype.OnUnregister = function () {
                    if (this.region)
                        this.service.Unmap(this.region);
                    this.region = null;
                    if (this.cbHandle)
                        this.service.UnregisterCallback(this.cbHandle);
                    this.cbHandle = null;
                };
                HD44780U.prototype.Read = function (address, type) {
                    switch (address) {
                        case 0x00:
                            return this.ioctl;
                        case 0x04:
                            if (this.nibbleMode) {
                                var ret = this.latched ? ((this.db & 0x0F) << 4) : (this.db & 0xF0);
                                this.latched = !this.latched;
                                return ret;
                            }
                            else {
                                return this.db;
                            }
                    }
                    return 0;
                };
                HD44780U.prototype.Write = function (address, type, value) {
                    switch (address) {
                        case 0x00:
                            this.ioctl = value;
                            break;
                        case 0x04:
                            if (this.nibbleMode) {
                                this.db = this.latched ? (this.db | (value >>> 4)) : value;
                                this.latched = !this.latched;
                            }
                            else {
                                this.db = value;
                            }
                            break;
                    }
                };
                HD44780U.prototype.Exec = function () {
                    var _this = this;
                    var op = this.Decode();
                    var execTime = op.call(this);
                    if (execTime <= 0)
                        return;
                    this.busy = true;
                    if (this.cbHandle)
                        this.service.UnregisterCallback(this.cbHandle);
                    if (execTime > 0) {
                        var t = execTime * (270000 / HD44780U.crystalFrequency);
                        this.cbHandle = this.service.RegisterCallback(t, false, function () {
                            _this.busy = false;
                        });
                    }
                    else {
                        this.busy = false;
                    }
                };
                HD44780U.prototype.Decode = function () {
                    if (this.rs) {
                        if (this.rw)
                            return this.ReadRamData;
                        else
                            return this.WriteRamData;
                    }
                    else if (this.rw) {
                        return this.ReadBusyFlagAndAddress;
                    }
                    else {
                        var i = 7;
                        do {
                            if (this._db & (1 << i))
                                break;
                            i = i - 1;
                        } while (i >= 0);
                        switch (i) {
                            case 0:
                                return this.ClearDisplay;
                            case 1:
                                return this.ReturnHome;
                            case 2:
                                return this.SetEntryMode;
                            case 3:
                                return this.SetDisplayControl;
                            case 4:
                                return this.ShiftCursorOrDisplay;
                            case 5:
                                return this.SetFunction;
                            case 6:
                                return this.SetCGRamAddress;
                            case 7:
                                return this.SetDDRamAddress;
                        }
                    }
                };
                HD44780U.prototype.ClearDisplay = function () {
                    for (var i = 0; i < this.ddRam.length; i++)
                        this.ddRam[i] = 0x20;
                    this.ac = 0;
                    this.cgRamContext = false;
                    this.incrementAc = true;
                    this.RaiseEvent('HD44780U.ClearDisplay');
                    return 1.52e-3;
                };
                HD44780U.prototype.ReturnHome = function () {
                    this.ac = 0;
                    this.cgRamContext = false;
                    this.RaiseEvent('HD44780U.ReturnHome');
                    return 1.52e-3;
                };
                HD44780U.prototype.SetEntryMode = function () {
                    this.shiftDisplay = (this.db & 0x01) == 0x01;
                    this.incrementAc = (this.db & 0x02) == 0x02;
                    this.RaiseEvent('HD44780U.EntryModeSet');
                    return 3.7e-5;
                };
                HD44780U.prototype.SetDisplayControl = function () {
                    this.cursorBlink = (this.db & 0x01) == 0x01;
                    this.showCursor = (this.db & 0x02) == 0x02;
                    this.displayEnabled = (this.db & 0x04) == 0x04;
                    this.RaiseEvent('HD44780U.DisplayControl');
                    return 3.7e-5;
                };
                HD44780U.prototype.ShiftCursorOrDisplay = function () {
                    var shiftDisplay = (this.db & 0x08) == 0x08;
                    var shiftRight = (this.db & 0x04) == 0x04;
                    if (shiftDisplay) {
                        this.RaiseEvent('HD44780U.DisplayShift', { 'shiftRight': shiftRight });
                    }
                    else {
                        this.UpdateAddressCounter(shiftRight);
                        this.RaiseEvent('HD44780U.CursorShift');
                    }
                    return 3.7e-5;
                };
                HD44780U.prototype.SetFunction = function () {
                    this.largeFont = (this.db & 0x04) == 0x04;
                    this.secondDisplayLine = (this.db & 0x08) == 0x08;
                    this.nibbleMode = (this.db & 0x10) == 0;
                    this.RaiseEvent('HD44780U.FunctionSet');
                    return 3.7e-5;
                };
                HD44780U.prototype.SetCGRamAddress = function () {
                    this.ac = this.db & 0x3F;
                    this.cgRamContext = true;
                    return 3.7e-5;
                };
                HD44780U.prototype.SetDDRamAddress = function () {
                    this.ac = this.db & 0x7F;
                    this.RaiseEvent('HD44780U.DDRamAddressSet');
                    this.cgRamContext = false;
                    return 3.7e-5;
                };
                HD44780U.prototype.ReadBusyFlagAndAddress = function () {
                    this.db = ((this.busy ? 1 : 0) << 7) | (this.ac & 0x7F);
                    return 0;
                };
                HD44780U.prototype.WriteRamData = function () {
                    if (this.cgRamContext) {
                        throw new Error('Not implemented');
                    }
                    else {
                        if (this.secondDisplayLine) {
                            if (this.ac < 0x28)
                                this.ddRam[this.ac] = this.db;
                            else if (this.ac >= 0x40)
                                this.ddRam[this.ac - 0x18] = this.db;
                        }
                        else {
                            this.ddRam[this.ac] = this.db;
                        }
                    }
                    this.UpdateAddressCounter(this.incrementAc);
                    this.RaiseEvent('HD44780U.DataWrite');
                    return 3.7e-5;
                };
                HD44780U.prototype.ReadRamData = function () {
                    if (this.cgRamContext) {
                        throw new Error('Not implemented');
                    }
                    else {
                        if (this.secondDisplayLine) {
                            if (this.ac < 0x28)
                                this.db = this.ddRam[this.ac];
                            else if (this.ac >= 0x40)
                                this.db = this.ddRam[this.ac - 0x18];
                        }
                        else {
                            this.db = this.ddRam[this.ac];
                        }
                    }
                    this.UpdateAddressCounter(this.incrementAc);
                    this.RaiseEvent('HD44780U.DataRead');
                    return 3.7e-5;
                };
                HD44780U.prototype.UpdateAddressCounter = function (increment) {
                    if (increment)
                        this.ac++;
                    else
                        this.ac--;
                    if (this.cgRamContext) {
                        if (this.ac < 0)
                            this.ac = 0x3F;
                        if (this.ac > 0x3F)
                            this.ac = 0;
                    }
                    else {
                        if (this.ac < 0)
                            this.ac = 0x7F;
                        if (this.ac > 0x7F)
                            this.ac = 0;
                    }
                };
                HD44780U.prototype.RaiseEvent = function (event, opts) {
                    var args = {
                        ddRam: this.ddRam,
                        addressCounter: this.ac,
                        incrementAddressCounter: this.incrementAc,
                        displayEnabled: this.displayEnabled,
                        showCursor: this.showCursor,
                        cursorBlink: this.cursorBlink,
                        shiftDisplay: this.shiftDisplay,
                        largeFont: this.largeFont,
                        secondDisplayLine: this.secondDisplayLine,
                        characterRom: this.characterRom,
                        nibbleMode: this.nibbleMode
                    };
                    if (opts != null) {
                        for (var key in opts) {
                            if (!opts.hasOwnProperty(key))
                                continue;
                            args[key] = opts[key];
                        }
                    }
                    this.service.RaiseEvent(event, this, args);
                };
                HD44780U.crystalFrequency = 270000;
                HD44780U.characterRomA02 = [
                    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
                    '◀', '▶', '“', '”', '↟', '↡', '⚫', '↵', '↑', '↓', '→', '←', '‹', '›', '▲', '▼',
                    ' ', '!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/',
                    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
                    '@', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
                    'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '\\', ']', '^', '_',
                    '`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
                    'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '|', '}', '~',
                    '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.',
                    '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.',
                    '.', '.',
                    '¡', '¢', '£', '¤', '¥', '¦', '§', '¨', '©', 'ª', '«', '¬', 'shy', '®', '¯',
                    '°', '±', '²', '³', '´', 'µ', '¶', '·', '¸', '¹', 'º', '»', '¼', '½', '¾', '¿',
                    'À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï',
                    'Ð', 'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', '×', 'Ø', 'Ù', 'Ú', 'Û', 'Ü', 'Ý', 'Þ', 'ß',
                    'à', 'á', 'â', 'ã', 'ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï',
                    'ð', 'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', '÷', 'ø', 'ù', 'ú', 'û', 'ü', 'ý', 'þ', 'ÿ'
                ];
                HD44780U.characterRomA00 = [
                    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
                    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
                    ' ', '!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/',
                    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
                    '@', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
                    'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '¥', ']', '^', '_',
                    '`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
                    'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '|', '}', '→', '←',
                    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
                    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
                    ' ', '｡', '｢', '｣', '､', '･', 'ｦ', 'ｧ', 'ｨ', 'ｩ', 'ｪ', 'ｫ', 'ｬ', 'ｭ', 'ｮ', 'ｯ',
                    'ｰ', 'ｱ', 'ｲ', 'ｳ', 'ｴ', 'ｵ', 'ｶ', 'ｷ', 'ｸ', 'ｹ', 'ｺ', 'ｻ', 'ｼ', 'ｽ', 'ｾ', 'ｿ',
                    'ﾀ', 'ﾁ', 'ﾂ', 'ﾃ', 'ﾄ', 'ﾅ', 'ﾆ', 'ﾇ', 'ﾈ', 'ﾉ', 'ﾊ', 'ﾋ', 'ﾌ', 'ﾍ', 'ﾎ', 'ﾏ',
                    'ﾐ', 'ﾑ', 'ﾒ', 'ﾓ', 'ﾔ', 'ﾕ', 'ﾖ', 'ﾗ', 'ﾘ', 'ﾙ', 'ﾚ', 'ﾛ', 'ﾜ', 'ﾝ', 'ﾞ', 'ﾟ',
                    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
                    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '
                ];
                return HD44780U;
            }(Simulator.Device));
            Devices.HD44780U = HD44780U;
        })(Devices = Simulator.Devices || (Simulator.Devices = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Devices;
        (function (Devices) {
            var PIC = (function (_super) {
                __extends(PIC, _super);
                function PIC(baseAddress, irq, fiq) {
                    _super.call(this, baseAddress);
                    this._pending = 0;
                    this._mask = 0x003FFFFF;
                    this.mode = 0;
                    this.priority = new Array(PIC.numSources);
                    this.reversePriority = new Array(PIC.numSources);
                    this.pending = 0;
                    this.pendingByPriority = 0;
                    this.outFIQ = false;
                    this.outIRQ = false;
                    this.irq = irq;
                    this.fiq = fiq;
                    for (var i = 0; i < PIC.numSources; i++)
                        this.priority[i] = this.reversePriority[i] = i;
                }
                Object.defineProperty(PIC.prototype, "mask", {
                    get: function () {
                        return this._mask;
                    },
                    set: function (v) {
                        this._mask = v;
                        this.UpdateState();
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(PIC.prototype, "offset", {
                    get: function () {
                        if (this.pendingByPriority == 0)
                            return 0x00000054;
                        for (var i = PIC.numSources - 1; i >= 0; i--) {
                            if ((this.pendingByPriority >>> i) & 0x01) {
                                var source = this.priority[i];
                                if (!this.IsMasked(source))
                                    return source << 2;
                            }
                        }
                        return 0x00000054;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(PIC.prototype, "fiqOffset", {
                    get: function () {
                        if (this.pendingByPriority == 0)
                            return 0x00000054;
                        for (var i = PIC.numSources - 1; i >= 0; i--) {
                            if ((this.pendingByPriority >>> i) & 0x01) {
                                var source = this.priority[i];
                                if (!this.IsMasked(source) && this.IsFIQ(source))
                                    return source << 2;
                            }
                        }
                        return 0x00000054;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(PIC.prototype, "irqOffset", {
                    get: function () {
                        if (this.pendingByPriority == 0)
                            return 0x00000054;
                        for (var i = PIC.numSources - 1; i >= 0; i--) {
                            if ((this.pendingByPriority >>> i) & 0x01) {
                                var source = this.priority[i];
                                if (!this.IsMasked(source) && !this.IsFIQ(source))
                                    return source << 2;
                            }
                        }
                        return 0x00000054;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(PIC.prototype, "interruptsDisabled", {
                    get: function () {
                        return ((this.mask >>> 21) & 0x01) == 0x01;
                    },
                    enumerable: true,
                    configurable: true
                });
                PIC.prototype.WritePendingRegister = function (v) {
                    this.pending &= ~v;
                    this.pendingByPriority = 0;
                    for (var i = 0; i < PIC.numSources; i++) {
                        if ((this.pending >>> i) & 0x01)
                            this.pendingByPriority |= (1 << this.reversePriority[i]);
                    }
                    this.UpdateState();
                };
                PIC.prototype.WritePendingTestRegister = function (v) {
                    this.pending = v;
                    this.pendingByPriority = 0;
                    for (var i = 0; i < PIC.numSources; i++) {
                        if ((this.pending >>> i) & 0x01)
                            this.pendingByPriority |= (1 << this.reversePriority[i]);
                    }
                    this.UpdateState();
                };
                PIC.prototype.WritePriorityRegister = function (index, v) {
                    for (var i = 0; i < 4; i++) {
                        this.priority[index * 4 + i] = (v >>> i * 8) & 0x1F;
                        this.reversePriority[(v >>> i * 8) & 0x1F] = index * 4 + i;
                    }
                };
                PIC.prototype.ReadPriorityRegister = function (index) {
                    var ret = 0;
                    for (var i = 3; i >= 0; i--)
                        ret = (ret << 8) + this.priority[index * 4 + i];
                    return ret;
                };
                PIC.prototype.OnRegister = function (service) {
                    var _this = this;
                    this.service = service;
                    this.region = new Simulator.Region(this.baseAddress, PIC.regSize, function (a, t) { return _this.Read(a, t); }, function (a, t, v) { _this.Write(a, t, v); });
                    if (!service.Map(this.region))
                        return false;
                    return true;
                };
                PIC.prototype.OnUnregister = function () {
                    if (this.region)
                        this.service.Unmap(this.region);
                    this.region = null;
                };
                PIC.prototype.Read = function (address, type) {
                    switch (address) {
                        case 0x00:
                            return this.mode;
                        case 0x04:
                            return this.pending;
                        case 0x08:
                            return this.mask;
                        case 0x0C:
                        case 0x10:
                        case 0x14:
                        case 0x18:
                        case 0x1C:
                        case 0x20:
                            return this.ReadPriorityRegister((address - 0x0C) / 4);
                        case 0x24:
                            return this.offset;
                        case 0x28:
                            return this.pendingByPriority;
                        case 0x30:
                            return this.fiqOffset;
                        case 0x34:
                            return this.irqOffset;
                    }
                    return 0;
                };
                PIC.prototype.Write = function (address, type, value) {
                    switch (address) {
                        case 0x00:
                            this.mode = value;
                            break;
                        case 0x04:
                            this.WritePendingRegister(value);
                            break;
                        case 0x08:
                            this.mask = value;
                            break;
                        case 0x0C:
                        case 0x10:
                        case 0x14:
                        case 0x18:
                        case 0x1C:
                        case 0x20:
                            this.WritePriorityRegister((address - 0x0C) / 4, value);
                            break;
                        case 0x2C:
                            this.WritePendingTestRegister(value);
                            break;
                    }
                };
                PIC.prototype.SetSignal = function (pin, active) {
                    if (pin < 0 || pin > PIC.numSources)
                        throw new Error('IllegalArgument');
                    if (active) {
                        this.pending |= (1 << pin);
                        this.pendingByPriority |= (1 << this.reversePriority[pin]);
                    }
                    this.UpdateState();
                };
                PIC.prototype.UpdateState = function () {
                    if (this.pending == 0 || this.interruptsDisabled) {
                        if (this.outFIQ)
                            this.fiq(false);
                        this.outFIQ = false;
                        if (this.outIRQ)
                            this.irq(false);
                        this.outIRQ = false;
                    }
                    else {
                        var pendingFIQ = false, pendingIRQ = false;
                        for (var i = 0; i < PIC.numSources; i++) {
                            if (!this.IsPending(i) || this.IsMasked(i))
                                continue;
                            if (this.IsFIQ(i))
                                pendingFIQ = true;
                            else
                                pendingIRQ = true;
                        }
                        if ((this.outFIQ && !pendingFIQ) || (!this.outFIQ && pendingFIQ))
                            this.fiq(this.outFIQ = !this.outFIQ);
                        if ((this.outIRQ && !pendingIRQ) || (!this.outIRQ && pendingIRQ))
                            this.irq(this.outIRQ = !this.outIRQ);
                    }
                };
                PIC.prototype.IsFIQ = function (source) {
                    return ((this.mode >>> source) & 0x01) == 0x01;
                };
                PIC.prototype.IsMasked = function (source) {
                    var global = 21;
                    return ((this.mask >>> global) & 0x01) == 0x01 ||
                        ((this.mask >>> source) & 0x01) == 0x01;
                };
                PIC.prototype.IsPending = function (source) {
                    return ((this.pending >>> source) & 0x01) == 0x01;
                };
                PIC.regSize = 0x34;
                PIC.numSources = 21;
                return PIC;
            }(Simulator.Device));
            Devices.PIC = PIC;
        })(Devices = Simulator.Devices || (Simulator.Devices = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Devices;
        (function (Devices) {
            var Timer = (function (_super) {
                __extends(Timer, _super);
                function Timer(baseAddress, interrupt) {
                    _super.call(this, baseAddress);
                    this._mode = 0;
                    this._comp = 0;
                    this.cbHandle = null;
                    this.referenceTime = 0;
                    this.stopValue = 0;
                    this.outINT = false;
                    this.interrupt = interrupt;
                }
                Object.defineProperty(Timer.prototype, "zeroReturn", {
                    get: function () {
                        return (this._mode & 0x40) == 0x40;
                    },
                    enumerable: true,
                    configurable: true
                });
                ;
                Object.defineProperty(Timer.prototype, "countEnable", {
                    get: function () {
                        return (this._mode & 0x80) == 0x80;
                    },
                    enumerable: true,
                    configurable: true
                });
                ;
                Object.defineProperty(Timer.prototype, "compareInterrupt", {
                    get: function () {
                        return (this._mode & 0x100) == 0x100;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Timer.prototype, "overflowInterrupt", {
                    get: function () {
                        return (this._mode & 0x200) == 0x200;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Timer.prototype, "equalFlag", {
                    get: function () {
                        return (this._mode & 0x400) == 0x400;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Timer.prototype, "overflowFlag", {
                    get: function () {
                        return (this._mode & 0x800) == 0x800;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Timer.prototype, "mode", {
                    get: function () {
                        return this._mode;
                    },
                    set: function (v) {
                        this.resolution = Timer.clockDivide[v & 0x03] / this.service.GetClockRate();
                        this.overflowTime = this.resolution * (1 << 16);
                        var enable = (v & 0x80) == 0x80;
                        if (!this.countEnable && enable)
                            this.referenceTime = this.service.GetTickCount() -
                                this.resolution * this.stopValue;
                        else if (this.countEnable && !enable)
                            this.stopValue = this.ReadCount();
                        var pending = (this._mode & 0xC00) != 0;
                        this._mode = v;
                        if (v & 0x400)
                            this._mode &= ~0x400;
                        if (v & 0x800)
                            this._mode &= ~0x800;
                        if (this.outINT && ((this._mode & 0xC00) == 0)) {
                            this.outINT = false;
                            this.interrupt(false);
                        }
                        this.SetTimeout();
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Timer.prototype, "comp", {
                    get: function () {
                        return this._comp;
                    },
                    set: function (v) {
                        if (v == this.comp)
                            return;
                        this.compEqualTime = this.resolution * v;
                        this._comp = v;
                        this.SetTimeout();
                    },
                    enumerable: true,
                    configurable: true
                });
                Timer.prototype.OnRegister = function (service) {
                    var _this = this;
                    this.service = service;
                    this.region = new Simulator.Region(this.baseAddress, Timer.regSize, function (a, t) { return _this.Read(a, t); }, function (a, t, v) { _this.Write(a, t, v); });
                    if (!service.Map(this.region))
                        return false;
                    return true;
                };
                Timer.prototype.OnUnregister = function () {
                    if (this.cbHandle)
                        this.service.UnregisterCallback(this.cbHandle);
                    this.cbHandle = null;
                    if (this.region)
                        this.service.Unmap(this.region);
                    this.region = null;
                };
                Timer.prototype.Read = function (address, type) {
                    switch (address) {
                        case 0x00:
                            return this.mode;
                        case 0x04:
                            return this.ReadCount();
                        case 0x08:
                            return this.comp;
                    }
                };
                Timer.prototype.Write = function (address, type, value) {
                    switch (address) {
                        case 0x00:
                            this.mode = value;
                            break;
                        case 0x04:
                            break;
                        case 0x08:
                            this.comp = value & 0xFFFF;
                            break;
                    }
                };
                Timer.prototype.SetTimeout = function () {
                    var _this = this;
                    if (this.cbHandle)
                        this.service.UnregisterCallback(this.cbHandle);
                    this.cbHandle = null;
                    if (!this.countEnable || (!this.overflowInterrupt && !this.compareInterrupt))
                        return;
                    var count = this.ReadCount();
                    var overflow = (1 << 16) - count, compare = ((this.comp - count) >>> 0) % (1 << 16);
                    var next, isOverflow = false;
                    if ((this.overflowInterrupt && !this.compareInterrupt) ||
                        (this.overflowInterrupt && overflow > compare)) {
                        next = overflow;
                        isOverflow = true;
                    }
                    else {
                        next = compare;
                    }
                    this.cbHandle = this.service.RegisterCallback(next * this.resolution, false, function () { _this.GenerateInterrupt(isOverflow); });
                };
                Timer.prototype.GenerateInterrupt = function (isOverflow) {
                    if (isOverflow) {
                        this._mode |= (1 << 11);
                        this.referenceTime = this.service.GetTickCount();
                    }
                    else {
                        this._mode |= (1 << 10);
                        if (this.zeroReturn)
                            this.referenceTime = this.service.GetTickCount();
                    }
                    if (!this.outINT) {
                        this.outINT = true;
                        this.interrupt(true);
                    }
                };
                Timer.prototype.ReadCount = function () {
                    if (this.countEnable == false)
                        return this.stopValue;
                    return (((this.service.GetTickCount() - this.referenceTime) /
                        this.resolution) | 0) % (1 << 16);
                };
                Timer.prototype.RaiseEvent = function (event, opts) {
                    var args = {};
                    if (opts != null) {
                        for (var key in opts) {
                            if (!opts.hasOwnProperty(key))
                                continue;
                            args[key] = opts[key];
                        }
                    }
                    this.service.RaiseEvent(event, this, args);
                };
                Timer.regSize = 0x0C;
                Timer.clockDivide = [0x01, 0x10, 0x100, 0x1000];
                return Timer;
            }(Simulator.Device));
            Devices.Timer = Timer;
        })(Devices = Simulator.Devices || (Simulator.Devices = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Devices;
        (function (Devices) {
            var TL16C750 = (function (_super) {
                __extends(TL16C750, _super);
                function TL16C750(baseAddress, interrupt) {
                    _super.call(this, baseAddress);
                    this._ier = 0;
                    this._fcr = 0;
                    this._lcr = 0;
                    this._dll = 0;
                    this._dlm = 0;
                    this.interruptSignal = false;
                    this.fifosEnabled = false;
                    this.rxFifo = new Array();
                    this.txFifo = new Array();
                    this.fifoSize = 16;
                    this.fifoTriggerLevel = 0;
                    this.overrunError = false;
                    this.cbHandle = null;
                    this.sInData = new Array();
                    this.thrEmpty = true;
                    this.dataReady = false;
                    this.cbTimeoutHandle = null;
                    this.characterTimeout = false;
                    this.mcr = 0;
                    this.msr = 0;
                    this.scr = 0;
                    this.interrupt = interrupt;
                }
                Object.defineProperty(TL16C750.prototype, "rbr", {
                    get: function () {
                        if (this.rxFifo.length == 0)
                            return 0;
                        this.ResetCharacterTimeout();
                        var v = this.rxFifo.shift();
                        this.rbrReadSinceLastTransfer = true;
                        this.dataReady = this.rxFifo.length > 0;
                        return v;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "dataInRsr", {
                    get: function () {
                        return this.sInData.length > 0;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "rsr", {
                    get: function () {
                        return this.sInData.shift();
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "dataInThr", {
                    get: function () {
                        return this.txFifo.length > 0;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "thr", {
                    get: function () {
                        return this.txFifo.shift();
                    },
                    set: function (v) {
                        if (!this.fifosEnabled) {
                            this.txFifo[0] = v;
                        }
                        else {
                            if (this.txFifo.length >= this.fifoSize)
                                this.txFifo[this.fifoSize - 1] = v;
                            else
                                this.txFifo.push(v);
                        }
                        this.thrEmpty = false;
                        if (!this.cbHandle)
                            this.SetTransferCallback();
                        this.SetINTRPT();
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "ier", {
                    get: function () {
                        return this._ier;
                    },
                    set: function (v) {
                        this._ier = v;
                        this.SetINTRPT();
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "iir", {
                    get: function () {
                        var v = 0x01;
                        if (this.overrunError && (this.ier & 0x04)) {
                            v = 0x06;
                        }
                        else if (this.fifosEnabled && (this.rxFifo.length >= this.fifoTriggerLevel) &&
                            (this.ier & 0x01)) {
                            v = 0x04;
                        }
                        else if (this.fifosEnabled && this.characterTimeout && (this.ier & 0x01)) {
                            v = 0x0C;
                        }
                        else if (!this.fifosEnabled && (this.rxFifo.length > 0) && (this.ier & 0x01)) {
                            v = 0x04;
                        }
                        else if (this.thrEmpty && (this.ier & 0x02)) {
                            v = 0x02;
                        }
                        if (this.fifosEnabled)
                            v |= 0xC0;
                        if (this.fifoSize == 64)
                            v |= 0x20;
                        return v;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "fcr", {
                    set: function (v) {
                        if ((this.fcr & 0x01) !== (v & 0x01))
                            this.rxFifo.length = this.txFifo.length = 0;
                        if ((this.fifosEnabled = (v & 0x01) == 1)) {
                            if (v & 0x02)
                                this.rxFifo.length = 0;
                            if (v & 0x04)
                                this.txFifo.length = 0;
                            if (this.lcr & 0x80)
                                this.fifoSize = (v & 0x20) ? 64 : 16;
                            else
                                v = (v & ~0x20) | (this.fcr & 0x20);
                            var l = this.fifoSize == 64 ? [1, 16, 32, 56] : [1, 4, 8, 14];
                            this.fifoTriggerLevel = l[(v >>> 6) & 0x03];
                        }
                        this.SetINTRPT();
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "lcr", {
                    get: function () {
                        return this._lcr;
                    },
                    set: function (v) {
                        this._lcr = v;
                        if (this.cbHandle)
                            this.SetTransferCallback();
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "lsr", {
                    get: function () {
                        var v = this.dataReady ? 1 : 0;
                        if (this.overrunError)
                            v |= 0x02;
                        if (this.thrEmpty) {
                            v |= 0x20;
                            if (this.txFifo.length == 0)
                                v |= 0x40;
                        }
                        this.overrunError = false;
                        return v;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "dll", {
                    get: function () {
                        return this._dll;
                    },
                    set: function (v) {
                        this._dll = v;
                        if (this.cbHandle)
                            this.SetTransferCallback();
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "dlm", {
                    get: function () {
                        return this._dlm;
                    },
                    set: function (v) {
                        this._dlm = v;
                        if (this.cbHandle)
                            this.SetTransferCallback();
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(TL16C750.prototype, "baudrate", {
                    get: function () {
                        var divisor = (this.dlm << 8) + this.dll;
                        return Math.floor(TL16C750.crystalFrequency / (16 * divisor));
                    },
                    enumerable: true,
                    configurable: true
                });
                TL16C750.prototype.SerialInput = function (character) {
                    if (character < 0 || character > 255)
                        throw new Error('character must be in range [0, 255].');
                    this.sInData.push(character);
                    if (!this.cbHandle)
                        this.SetTransferCallback();
                };
                TL16C750.prototype.OnRegister = function (service) {
                    var _this = this;
                    this.service = service;
                    this.region = new Simulator.Region(this.baseAddress, 0x100, function (a, t) { return _this.Read(a, t); }, function (a, t, v) { _this.Write(a, t, v); });
                    if (!service.Map(this.region))
                        return false;
                    return true;
                };
                TL16C750.prototype.OnUnregister = function () {
                    if (this.region)
                        this.service.Unmap(this.region);
                    this.region = null;
                    if (this.cbHandle)
                        this.ClearTransferCallback();
                    this.cbHandle = null;
                };
                TL16C750.prototype.Read = function (address, type) {
                    switch (address) {
                        case 0x00: return this.dlab ? this.dll : this.rbr;
                        case 0x04: return this.dlab ? this.dlm : this.ier;
                        case 0x08: return this.iir;
                        case 0x0C: return this.lcr;
                        case 0x10: return this.mcr;
                        case 0x14: return this.lsr;
                        case 0x18: return this.msr;
                        case 0x1C: return this.scr;
                    }
                    return 0;
                };
                TL16C750.prototype.Write = function (address, type, value) {
                    switch (address) {
                        case 0x00:
                            if (this.dlab)
                                this.dll = value;
                            else
                                this.thr = value;
                            break;
                        case 0x04:
                            if (this.dlab)
                                this.dlm = value;
                            else
                                this.ier = value;
                            break;
                        case 0x08:
                            this.fcr = value;
                            break;
                        case 0x0C:
                            this.lcr = value;
                            break;
                        case 0x10:
                            this.mcr = value;
                            break;
                        case 0x14:
                            break;
                        case 0x18:
                            this.msr = value;
                            break;
                        case 0x1C:
                            this.scr = value;
                            break;
                    }
                };
                TL16C750.prototype.SetTransferCallback = function () {
                    var _this = this;
                    var bitsPerWord = [5, 6, 7, 8];
                    var n = 2 + bitsPerWord[this.lcr & 0x03];
                    if (this.lcr & 0x04)
                        n = n + (n == 7 ? .5 : 1);
                    if (this.lcr & 0x08)
                        n = n + 1;
                    this.characterTime = n / this.baudrate;
                    if (this.cbHandle)
                        this.ClearTransferCallback();
                    this.cbHandle = this.service.RegisterCallback(this.characterTime, true, function () {
                        _this.TransferCallback();
                    });
                };
                TL16C750.prototype.ClearTransferCallback = function () {
                    if (this.cbHandle)
                        this.service.UnregisterCallback(this.cbHandle);
                    this.cbHandle = null;
                };
                TL16C750.prototype.TransferCallback = function () {
                    if (!this.dataInRsr && !this.dataInThr)
                        this.ClearTransferCallback();
                    if (this.dataInRsr)
                        this.TransferIntoRbr(this.rsr);
                    if (this.dataInThr)
                        this.TransferIntoTsr(this.thr);
                    this.SetINTRPT();
                };
                TL16C750.prototype.TransferIntoRbr = function (rsr) {
                    if (!this.fifosEnabled) {
                        this.overrunError = !this.rbrReadSinceLastTransfer;
                        this.rxFifo[0] = rsr;
                    }
                    else {
                        if (this.rxFifo.length < this.fifoSize) {
                            this.rxFifo.push(rsr);
                        }
                        else {
                            this.overrunError = true;
                        }
                    }
                    this.dataReady = true;
                    this.rbrReadSinceLastTransfer = false;
                    this.ResetCharacterTimeout();
                };
                TL16C750.prototype.TransferIntoTsr = function (thr) {
                    this.thrEmpty = (!this.fifosEnabled) || (this.txFifo.length < this.fifoSize);
                    this.service.RaiseEvent('TL16C750.Data', this, thr);
                };
                TL16C750.prototype.SetINTRPT = function () {
                    var oldLevel = this.interruptSignal;
                    this.interruptSignal = (this.iir & 0x01) == 0;
                    if (oldLevel !== this.interruptSignal)
                        this.interrupt(this.interruptSignal);
                    else if (this.interruptSignal)
                        this.interrupt(true);
                };
                Object.defineProperty(TL16C750.prototype, "dlab", {
                    get: function () {
                        return ((this.lcr >>> 7) & 0x01) == 1;
                    },
                    enumerable: true,
                    configurable: true
                });
                TL16C750.prototype.ResetCharacterTimeout = function () {
                    var _this = this;
                    if (this.cbTimeoutHandle)
                        this.service.UnregisterCallback(this.cbTimeoutHandle);
                    this.cbTimeoutHandle = null;
                    this.characterTimeout = false;
                    if (!this.fifosEnabled)
                        return;
                    var timeout = 4 * this.characterTime;
                    this.cbTimeoutHandle = this.service.RegisterCallback(timeout, false, function () {
                        if (_this.rxFifo.length > 0 && _this.fifosEnabled)
                            _this.characterTimeout = true;
                        _this.SetINTRPT();
                    });
                };
                TL16C750.crystalFrequency = 1843200;
                return TL16C750;
            }(Simulator.Device));
            Devices.TL16C750 = TL16C750;
        })(Devices = Simulator.Devices || (Simulator.Devices = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Devices;
        (function (Devices) {
            var Watchdog = (function (_super) {
                __extends(Watchdog, _super);
                function Watchdog(baseAddress, oscin) {
                    _super.call(this, baseAddress);
                    this._control = Watchdog.counterDisabled;
                    this._preload = 0x0FFF;
                    this._key = 0;
                    this.cbHandle = null;
                    this.lastKeyWrite = 0;
                    var frequency = Watchdog.oscillatorFrequency;
                    if (oscin)
                        frequency = oscin;
                    this.counterResolution = (1 << 13) / frequency;
                }
                Object.defineProperty(Watchdog.prototype, "activated", {
                    get: function () {
                        return this.cbHandle != null;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Watchdog.prototype, "control", {
                    get: function () {
                        return this._control;
                    },
                    set: function (v) {
                        if (this.activated)
                            return;
                        if (v == Watchdog.counterDisabled)
                            return;
                        this._control = v;
                        this.activated = true;
                        this.ReloadCounter();
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Watchdog.prototype, "preload", {
                    get: function () {
                        return this._preload;
                    },
                    set: function (v) {
                        if (this.activated)
                            return;
                        this._preload = v & 0xFFF;
                        this.countDownTime = this.counterResolution * this._preload;
                    },
                    enumerable: true,
                    configurable: true
                });
                Watchdog.prototype.OnRegister = function (service) {
                    var _this = this;
                    this.service = service;
                    this.region = new Simulator.Region(this.baseAddress, Watchdog.regSize, function (a, t) { return _this.Read(a, t); }, function (a, t, v) { _this.Write(a, t, v); });
                    if (!service.Map(this.region))
                        return false;
                    return true;
                };
                Watchdog.prototype.OnUnregister = function () {
                    if (this.cbHandle)
                        this.service.UnregisterCallback(this.cbHandle);
                    this.cbHandle = null;
                    if (this.region)
                        this.service.Unmap(this.region);
                    this.region = null;
                };
                Watchdog.prototype.Read = function (address, type) {
                    switch (address) {
                        case 0x00:
                            return this.control;
                        case 0x04:
                            return this.preload;
                        case 0x08:
                            return 0;
                        case 0x0C:
                            return this.ReadCounter();
                    }
                };
                Watchdog.prototype.Write = function (address, type, value) {
                    switch (address) {
                        case 0x00:
                            this.control = value;
                            break;
                        case 0x04:
                            this.preload = value;
                            break;
                        case 0x08:
                            this.WriteKeyRegister(value);
                            break;
                        case 0x0C:
                            break;
                    }
                };
                Watchdog.prototype.ReloadCounter = function () {
                    var _this = this;
                    this.lastReloadTime = this.service.GetTickCount();
                    if (this.cbHandle)
                        this.service.UnregisterCallback(this.cbHandle);
                    this.cbHandle = this.service.RegisterCallback(this.countDownTime, false, function () {
                        _this.ResetSystem();
                    });
                };
                Watchdog.prototype.ReadCounter = function () {
                    if (!this.activated)
                        return Watchdog.initialCounterValue;
                    var t = 1.0 - ((this.service.GetTickCount() - this.lastReloadTime) /
                        this.countDownTime);
                    return (this.preload * t) | 0;
                };
                Watchdog.prototype.ResetSystem = function () {
                    this.RaiseEvent('Watchdog.Reset');
                };
                Watchdog.prototype.WriteKeyRegister = function (v) {
                    if (v != Watchdog.reloadSequence[0] && v != Watchdog.reloadSequence[1]) {
                        this.ResetSystem();
                    }
                    else {
                        if (this.lastKeyWrite == Watchdog.reloadSequence[0] &&
                            v == Watchdog.reloadSequence[1]) {
                            this.ReloadCounter();
                        }
                        this.lastKeyWrite = v;
                    }
                };
                Watchdog.prototype.RaiseEvent = function (event, opts) {
                    var args = {};
                    if (opts != null) {
                        for (var key in opts) {
                            if (!opts.hasOwnProperty(key))
                                continue;
                            args[key] = opts[key];
                        }
                    }
                    this.service.RaiseEvent(event, this, args);
                };
                Watchdog.regSize = 0x10;
                Watchdog.reloadSequence = [0xE51A, 0xA35C];
                Watchdog.counterDisabled = 0x5312ACED;
                Watchdog.oscillatorFrequency = 4000000;
                Watchdog.initialCounterValue = 0x01FFFFFF;
                return Watchdog;
            }(Simulator.Device));
            Devices.Watchdog = Watchdog;
        })(Devices = Simulator.Devices || (Simulator.Devices = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Elf;
        (function (Elf) {
            (function (ElfMachine) {
                ElfMachine[ElfMachine["None"] = 0] = "None";
                ElfMachine[ElfMachine["M32"] = 1] = "M32";
                ElfMachine[ElfMachine["Sparc"] = 2] = "Sparc";
                ElfMachine[ElfMachine["X86"] = 3] = "X86";
                ElfMachine[ElfMachine["M68k"] = 4] = "M68k";
                ElfMachine[ElfMachine["M88k"] = 5] = "M88k";
                ElfMachine[ElfMachine["I860"] = 7] = "I860";
                ElfMachine[ElfMachine["Mips"] = 8] = "Mips";
                ElfMachine[ElfMachine["MipsRs4Be"] = 10] = "MipsRs4Be";
                ElfMachine[ElfMachine["Arm"] = 40] = "Arm";
            })(Elf.ElfMachine || (Elf.ElfMachine = {}));
            var ElfMachine = Elf.ElfMachine;
        })(Elf = Simulator.Elf || (Simulator.Elf = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Elf;
        (function (Elf) {
            (function (ElfOsAbi) {
                ElfOsAbi[ElfOsAbi["None"] = 0] = "None";
                ElfOsAbi[ElfOsAbi["HpUx"] = 1] = "HpUx";
                ElfOsAbi[ElfOsAbi["NetBSD"] = 2] = "NetBSD";
                ElfOsAbi[ElfOsAbi["Gnu"] = 3] = "Gnu";
                ElfOsAbi[ElfOsAbi["Solaris"] = 6] = "Solaris";
                ElfOsAbi[ElfOsAbi["Aix"] = 7] = "Aix";
                ElfOsAbi[ElfOsAbi["Irix"] = 8] = "Irix";
                ElfOsAbi[ElfOsAbi["FreeBSD"] = 9] = "FreeBSD";
                ElfOsAbi[ElfOsAbi["Tru64"] = 10] = "Tru64";
                ElfOsAbi[ElfOsAbi["Modesto"] = 11] = "Modesto";
                ElfOsAbi[ElfOsAbi["OpenBSD"] = 12] = "OpenBSD";
                ElfOsAbi[ElfOsAbi["OpenVMS"] = 13] = "OpenVMS";
                ElfOsAbi[ElfOsAbi["HpNSK"] = 14] = "HpNSK";
                ElfOsAbi[ElfOsAbi["Aros"] = 15] = "Aros";
                ElfOsAbi[ElfOsAbi["FenixOS"] = 16] = "FenixOS";
                ElfOsAbi[ElfOsAbi["CloudABI"] = 17] = "CloudABI";
                ElfOsAbi[ElfOsAbi["OpenVOS"] = 18] = "OpenVOS";
            })(Elf.ElfOsAbi || (Elf.ElfOsAbi = {}));
            var ElfOsAbi = Elf.ElfOsAbi;
        })(Elf = Simulator.Elf || (Simulator.Elf = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Elf;
        (function (Elf) {
            (function (ElfSegmentType) {
                ElfSegmentType[ElfSegmentType["Null"] = 0] = "Null";
                ElfSegmentType[ElfSegmentType["Load"] = 1] = "Load";
                ElfSegmentType[ElfSegmentType["Dynamic"] = 2] = "Dynamic";
                ElfSegmentType[ElfSegmentType["Interpreter"] = 3] = "Interpreter";
                ElfSegmentType[ElfSegmentType["Note"] = 4] = "Note";
                ElfSegmentType[ElfSegmentType["Shlib"] = 5] = "Shlib";
                ElfSegmentType[ElfSegmentType["PHdr"] = 6] = "PHdr";
            })(Elf.ElfSegmentType || (Elf.ElfSegmentType = {}));
            var ElfSegmentType = Elf.ElfSegmentType;
        })(Elf = Simulator.Elf || (Simulator.Elf = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Elf;
        (function (Elf) {
            (function (ElfSegmentFlag) {
                ElfSegmentFlag[ElfSegmentFlag["Execute"] = 1] = "Execute";
                ElfSegmentFlag[ElfSegmentFlag["Write"] = 2] = "Write";
                ElfSegmentFlag[ElfSegmentFlag["Read"] = 4] = "Read";
            })(Elf.ElfSegmentFlag || (Elf.ElfSegmentFlag = {}));
            var ElfSegmentFlag = Elf.ElfSegmentFlag;
        })(Elf = Simulator.Elf || (Simulator.Elf = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Elf;
        (function (Elf) {
            var ElfSegment = (function () {
                function ElfSegment(type, offset, vAddr, pAddr, fileSize, memorySize, flags, alignment, bytes) {
                    this.type = type;
                    this.offset = offset;
                    this.virtualAddress = vAddr;
                    this.physicalAddress = pAddr;
                    this.fileSize = fileSize;
                    this.memorySize = memorySize;
                    this.flags = flags;
                    this.alignment = alignment;
                    this.bytes = bytes;
                }
                Object.defineProperty(ElfSegment.prototype, "Type", {
                    get: function () {
                        return this.type;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(ElfSegment.prototype, "Offset", {
                    get: function () {
                        return this.offset;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(ElfSegment.prototype, "VirtualAddress", {
                    get: function () {
                        return this.virtualAddress;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(ElfSegment.prototype, "PhysicalAddress", {
                    get: function () {
                        return this.physicalAddress;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(ElfSegment.prototype, "FileSize", {
                    get: function () {
                        return this.fileSize;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(ElfSegment.prototype, "MemorySize", {
                    get: function () {
                        return this.memorySize;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(ElfSegment.prototype, "Flags", {
                    get: function () {
                        return this.flags;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(ElfSegment.prototype, "Alignment", {
                    get: function () {
                        return this.alignment;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(ElfSegment.prototype, "Bytes", {
                    get: function () {
                        return this.bytes;
                    },
                    enumerable: true,
                    configurable: true
                });
                return ElfSegment;
            }());
            Elf.ElfSegment = ElfSegment;
        })(Elf = Simulator.Elf || (Simulator.Elf = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Elf;
        (function (Elf) {
            (function (ElfType) {
                ElfType[ElfType["None"] = 0] = "None";
                ElfType[ElfType["Relocatable"] = 1] = "Relocatable";
                ElfType[ElfType["Executable"] = 2] = "Executable";
                ElfType[ElfType["Dynamic"] = 3] = "Dynamic";
                ElfType[ElfType["Core"] = 4] = "Core";
                ElfType[ElfType["LoProc"] = 65280] = "LoProc";
                ElfType[ElfType["HiProc"] = 65535] = "HiProc";
            })(Elf.ElfType || (Elf.ElfType = {}));
            var ElfType = Elf.ElfType;
        })(Elf = Simulator.Elf || (Simulator.Elf = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var BinaryReader = (function () {
            function BinaryReader(data) {
                this.pos = 0;
                this.data = data;
            }
            Object.defineProperty(BinaryReader.prototype, "Position", {
                get: function () {
                    return this.pos;
                },
                enumerable: true,
                configurable: true
            });
            BinaryReader.prototype.ReadUint8 = function () {
                if (this.pos >= this.data.length)
                    throw new Error('Eof');
                return this.data[this.pos++];
            };
            BinaryReader.prototype.ReadUint16 = function (bigEndian) {
                if (bigEndian === void 0) { bigEndian = false; }
                if ((this.pos + 1) >= this.data.length)
                    throw new Error('Eof');
                var val = 0;
                if (bigEndian) {
                    for (var i = 1; i >= 0; i--)
                        val = val + ((this.data[this.pos++] << (8 * i)) >>> 0);
                }
                else {
                    for (var i = 0; i < 2; i++)
                        val = val + ((this.data[this.pos++] << (8 * i)) >>> 0);
                }
                return val;
            };
            BinaryReader.prototype.ReadUint32 = function (bigEndian) {
                if (bigEndian === void 0) { bigEndian = false; }
                if ((this.pos + 3) >= this.data.length)
                    throw new Error('Eof');
                var val = 0;
                if (bigEndian) {
                    for (var i = 3; i >= 0; i--)
                        val = val + ((this.data[this.pos++] << (8 * i)) >>> 0);
                }
                else {
                    for (var i = 0; i < 4; i++)
                        val = val + ((this.data[this.pos++] << (8 * i)) >>> 0);
                }
                return val;
            };
            BinaryReader.prototype.ReadInt8 = function () {
                if (this.pos >= this.data.length)
                    throw new Error('Eof');
                return Simulator.Util.SignExtend(this.data[this.pos++], 8, 32);
            };
            BinaryReader.prototype.ReadInt16 = function (bigEndian) {
                if (bigEndian === void 0) { bigEndian = false; }
                if ((this.pos + 1) >= this.data.length)
                    throw new Error('Eof');
                var val = 0;
                if (bigEndian) {
                    for (var i = 1; i >= 0; i--)
                        val = val + (this.data[this.pos++] << (8 * i));
                }
                else {
                    for (var i = 0; i < 2; i++)
                        val = val + (this.data[this.pos++] << (8 * i));
                }
                return Simulator.Util.SignExtend(val, 16, 32);
            };
            BinaryReader.prototype.ReadInt32 = function (bigEndian) {
                if (bigEndian === void 0) { bigEndian = false; }
                if ((this.pos + 3) >= this.data.length)
                    throw new Error('Eof');
                var val = 0;
                if (bigEndian) {
                    for (var i = 3; i >= 0; i--)
                        val = val | (this.data[this.pos++] << (8 * i));
                }
                else {
                    for (var i = 0; i < 4; i++)
                        val = val | (this.data[this.pos++] << (8 * i));
                }
                return val;
            };
            BinaryReader.prototype.Seek = function (position) {
                if (position < 0 || position >= this.data.length)
                    throw new Error('Eof');
                var prev = this.pos;
                this.pos = position;
                return prev;
            };
            BinaryReader.prototype.ReadBytes = function (count) {
                var r = [];
                for (var i = 0; i < count; i++)
                    r.push(this.ReadUint8());
                return r;
            };
            return BinaryReader;
        }());
        Simulator.BinaryReader = BinaryReader;
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Elf;
        (function (Elf) {
            var Elf32 = (function () {
                function Elf32(data) {
                    this.segments = new Array();
                    var bReader = new Simulator.BinaryReader(data);
                    this.ReadElfHeader(bReader);
                    this.ReadSegments(bReader);
                }
                Object.defineProperty(Elf32.prototype, "BigEndian", {
                    get: function () {
                        return this.bigEndian;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Elf32.prototype, "Version", {
                    get: function () {
                        return this.version;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Elf32.prototype, "EntryPoint", {
                    get: function () {
                        return this.entryPoint;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Elf32.prototype, "Flags", {
                    get: function () {
                        return this.flags;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Elf32.prototype, "Type", {
                    get: function () {
                        return this.type;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Elf32.prototype, "OsAbi", {
                    get: function () {
                        return this.osAbi;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Elf32.prototype, "AbiVersion", {
                    get: function () {
                        return this.abiVersion;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Elf32.prototype, "Machine", {
                    get: function () {
                        return this.machine;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Elf32.prototype, "Segments", {
                    get: function () {
                        return this.segments;
                    },
                    enumerable: true,
                    configurable: true
                });
                Elf32.prototype.ReadElfHeader = function (br) {
                    br.ReadBytes(4).forEach(function (v, i) {
                        if (v != Elf32.magic[i])
                            throw new Error('Magic number mismatch');
                    });
                    if (br.ReadUint8() != 1)
                        throw new Error('ELF file is not in 32-bit file-format');
                    var dataEncoding = br.ReadUint8();
                    switch (dataEncoding) {
                        case 1:
                            this.bigEndian = false;
                            break;
                        case 2:
                            this.bigEndian = true;
                            break;
                        default:
                            throw new Error("Invalid ELF data-encoding (" + dataEncoding + ")");
                    }
                    if ((this.version = br.ReadUint8()) == 0)
                        throw new Error("Invalid ELF version (" + this.version + ")");
                    this.osAbi = br.ReadUint8();
                    this.abiVersion = br.ReadUint8();
                    br.ReadBytes(7);
                    if ((this.type = br.ReadUint16()) == 0)
                        throw new Error('No ELF file type specified');
                    this.machine = br.ReadUint16();
                    var elfVersion = br.ReadUint32();
                    if (this.version != elfVersion)
                        throw new Error("Version mismatch (" + this.version + " <=> " + elfVersion + ")");
                    this.entryPoint = br.ReadUint32();
                    this.phOffset = br.ReadUint32();
                    br.ReadUint32();
                    this.flags = br.ReadUint32();
                    var headerSize = br.ReadUint16();
                    if (Elf32.headerSize != headerSize)
                        throw new Error("Unexpected ELF header size (" + headerSize + ")");
                    var phEntrySize = br.ReadUint16();
                    if (Elf32.phEntrySize != phEntrySize)
                        throw new Error("Unexpected ELF program-header size (" + phEntrySize + ")");
                    this.phNumEntries = br.ReadUint16();
                };
                Elf32.prototype.ReadSegments = function (br) {
                    br.Seek(this.phOffset);
                    for (var i = 0; i < this.phNumEntries; i++)
                        this.segments.push(this.ReadSegment(br));
                };
                Elf32.prototype.ReadSegment = function (br) {
                    var type = br.ReadUint32(), offset = br.ReadUint32(), vAddr = br.ReadUint32(), pAddr = br.ReadInt32(), fSize = br.ReadUint32(), mSize = br.ReadUint32(), flags = br.ReadUint32(), align = br.ReadUint32();
                    var oldPos = br.Seek(offset);
                    var bytes = br.ReadBytes(fSize);
                    for (var i = fSize; i < mSize; i++)
                        bytes.push(0);
                    br.Seek(oldPos);
                    return new Elf.ElfSegment(type, offset, vAddr, pAddr, fSize, mSize, flags, align, bytes);
                };
                Elf32.magic = [0x7F, 0x45, 0x4C, 0x46];
                Elf32.headerSize = 0x34;
                Elf32.phEntrySize = 0x20;
                return Elf32;
            }());
            Elf.Elf32 = Elf32;
        })(Elf = Simulator.Elf || (Simulator.Elf = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Tests;
        (function (Tests) {
            var MockService = (function () {
                function MockService(clockRateMhz) {
                    this.raisedEvents = [];
                    this.cycles = 0;
                    this.clockRate = clockRateMhz * 1000000;
                }
                Object.defineProperty(MockService.prototype, "RaisedEvents", {
                    get: function () {
                        return this.raisedEvents;
                    },
                    enumerable: true,
                    configurable: true
                });
                MockService.prototype.Tick = function (ms) {
                    this.cycles = this.cycles + (this.clockRate * (ms / 1000.0) | 0);
                };
                MockService.prototype.Map = function (region) {
                    return true;
                };
                MockService.prototype.Unmap = function (region) {
                    return true;
                };
                MockService.prototype.RegisterCallback = function (timeout, periodic, callback) {
                    if (!periodic)
                        return self.setTimeout(callback, timeout * 1000);
                    return self.setInterval(callback, timeout * 1000);
                };
                MockService.prototype.UnregisterCallback = function (handle) {
                    self.clearInterval(handle);
                    self.clearTimeout(handle);
                    return true;
                };
                MockService.prototype.RegisterDevice = function (device) {
                    return true;
                };
                MockService.prototype.UnregisterDevice = function (device) {
                    return true;
                };
                MockService.prototype.RaiseEvent = function (event, sender, args) {
                    this.raisedEvents.push([event, args]);
                };
                MockService.prototype.GetClockRate = function () {
                    return this.clockRate;
                };
                MockService.prototype.GetCycles = function () {
                    return this.cycles;
                };
                MockService.prototype.GetTickCount = function () {
                    return this.cycles / this.clockRate;
                };
                return MockService;
            }());
            Tests.MockService = MockService;
        })(Tests = Simulator.Tests || (Simulator.Tests = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
describe('Assembler Tests', function () {
    var Assembler = ARM.Assembler.Assembler;
    var memoryLayout = {
        'TEXT': 0x40000,
        'DATA': 0x80000
    };
    var listing_1 = [
        '.arm',
        '.section .data',
        'hello_sio:',
        '.asciz "Hello World from serial I/O!"',
        '.section .text',
        '@ UART0 Registers',
        '.equ    U0RBR,            0xE0000000 @ Receiver Buffer',
        '.equ    U0THR,            0xE0000000 @ Transmitter Holding Buffer',
        '.equ    U0DLL,            0xE0000000 @ Divisor Latch Low Byte',
        '',
        '@ Some unrecognized directive',
        '.foobar 12 34'
    ].join('\n');
    var listing_2 = [
        '.arm',
        '.section .data',
        'hello_sio:',
        '.asciz "Hello World from serial I/O!"',
        '.section .text',
        '@ UART0 Registers',
        '.equ    U0RBR,            0xE0000000 @ Receiver Buffer',
        '.equ    U0THR,            0xE0000000 @ Transmitter Holding Buffer',
        '.equ    U0DLL,            0xE0000000 @ Divisor Latch Low Byte',
        '.equ    U0DLH,            0xE0000004 @ Divisor Latch High Byte',
        '.equ    U0IER,            0xE0000004 @ Interrupt Enable Register',
        '.equ    U0IIR,            0xE0000008 @ Interrupt Identification Register',
        '.equ    U0FCR,            0xE0000008 @ FIFO Control Register',
        '.equ    U0LCR,            0xE000000C @ Line Control Register',
        '.equ    U0LSR,            0xE0000014 @ Line Status Register',
        '.equ    U0SCR,            0xE000001C @ Scratch Register',
        '',
        '.equ    LCR8N1,           0x03       @ 8 Bits, 1 Stop bit, no parity',
        '.equ    PCON,             0xE01FC000 @ Power Control Register',
        '',
        '.equ    RAM_SIZE,         0x00008000 @ 32kb',
        '.equ    RAM_BASE,         0x00400000',
        '.equ    TOPSTACK,         RAM_BASE + RAM_SIZE',
        '',
        '@R13 acts as stack pointer by convention',
        'ldr  r0,  =TOPSTACK',
        'mov  r13, r0',
        '',
        '@ prints a string to the terminal',
        'main:',
        '  bl sio_init',
        '  ldr r0, =hello_sio',
        '  bl sio_puts',
        '  @ busy wait until UART is done before exiting',
        '  ldr r0, =U0LSR',
        'still_busy:',
        '    ldrb r1, [r0], #0',
        '    ands r1, #64',
        '    beq still_busy',
        '  bl _exit',
        '',
        '@ initializes UART0',
        'sio_init:',
        '   stmfd sp!, { r0-r1, lr }',
        '   ldr r0, =U0LCR',
        '   @enable DLAB to configure baudrate',
        '   mov r1, #128',
        '   strb r1, [r0], #0',
        '   @set baudrate to 115200 (DLH = 0x00, DLL = 0x01)',
        '   ldr r0, =U0DLH',
        '   mov r1, #0',
        '   strb r1, [r0], #0',
        '   ldr r0, =U0DLL',
        '   mov r1, #1',
        '   strb r1, [r0], #0',
        '   @clear DLAB and set mode to 8- N - 1',
        '   ldr r0, =U0LCR',
        '   ldrb r1, =LCR8N1',
        '   strb r1, [r0], #0',
        '   @disable all interrupts',
        '   ldr r0, =U0IER',
        '   mov r1, #0',
        '   strb r1, [r0], #0',
        '   @enable and reset 64- byte FIFOs',
        '   ldr r0, =U0FCR',
        '   mov r1, #39',
        '   strb r1, [r0], #0',
        '   @done!',
        '   ldmfd sp!, { r0-r1, lr }',
        '   bx lr',
        '',
        '@r0 -> character to transmit',
        'sio_putc:',
        '   stmfd sp!, { r1-r2, lr }',
        '   ldr r1, =U0LSR',
        '   fifo_full:',
        '       ldrb r2, [r1], #0',
        '       @cleared bit 5 means TXFIFO is full',
        '       ands r2, #32',
        '   beq fifo_full',
        '   ldr r1, =U0THR',
        '   strb r0, [r1], #0',
        '   ldmfd sp!, { r1-r2, lr }',
        '   bx lr',
        '',
        '@r0 -> null - terminated string to transmit',
        'sio_puts:',
        '   stmfd sp!, { r0-r1, lr }',
        '   mov r1, r0',
        '   char_loop:',
        '       ldrb r0, [r1], #1',
        '       cmp r0, #0',
        '       beq char_loop_end',
        '       bl sio_putc',
        '       b char_loop',
        '   char_loop_end:',
        '       ldmfd sp!, { r0-r1, lr }',
        '       bx lr',
        '',
        '@halts execution',
        '_exit:',
        '   @power is turned off by setting bit 1',
        '   ldr r0, =PCON',
        '   mov r1, #1',
        '   strb r1, [r0]',
        '.end'
    ].join('\n');
    it('Invalid Assembler Directive', function () {
        expect(function () {
            return Assembler.Assemble(listing_1, memoryLayout);
        }).toThrow();
    });
    it('Assemble Some Code', function () {
        var a_out = Assembler.Assemble(listing_2, memoryLayout);
        expect(a_out['TEXT']).toBeDefined();
        expect(a_out['DATA']).toBeDefined();
        expect(a_out['TEXT'].address).toBe(memoryLayout['TEXT']);
        expect(a_out['DATA'].address).toBe(memoryLayout['DATA']);
    });
    it('Assemble Instructions', function () {
        var instructions = {
            'mov r0, r0': 0xE1A00000,
            'adds r4, r0, r2': 0xE0904002,
            'adc r5, r1, r3': 0xE0A15003,
            'add r7, r8, r10, LSL #4': 0xE088720A,
            'add r1, pc, #123': 0xE28F107B,
            'mrs r0, cpsr': 0xE10F0000,
            'bic r0, r0, #0x1f': 0xE3C0001F,
            'orr r0, r0, #0x13': 0xE3800013,
            'stmfd r13!, {r0-r12, r14}': 0xE92D5FFF,
            'ldmfd r13!, {r0-r12, pc}': 0xE8BD9FFF,
            'swi 0x10': 0xEF000010,
            'ldmia r2, {r0, r1}': 0xE8920003,
            'movge r2, r0': 0xA1A02000,
            'movlt r2, r1': 0xB1A02001,
            'ldr r0, [r1, r2, lsl #2]': 0xE7910102,
            'sublts r3, r0, r1': 0xB0503001,
            'strcs r3, [r0], #4': 0x24803004
        };
        for (var key in instructions) {
            var sections = Assembler.Assemble(key, memoryLayout), data = sections['TEXT'].data, view = new Uint32Array(data.buffer);
            expect(view[0]).toBe(instructions[key]);
        }
    });
});
describe('BinaryReader Tests', function () {
    it('Read Bytes', function () {
        var r = new ARM.Simulator.BinaryReader([0x80, 0x40, 0x20, 0x10]);
        expect(r.ReadInt8()).toBe(0xFFFFFF80 .toInt32());
        r.Seek(0);
        expect(r.ReadUint8()).toBe(0x80);
        r.Seek(0);
        expect(r.ReadBytes(4)).toEqual([0x80, 0x40, 0x20, 0x10]);
    });
    it('Read Shorts', function () {
        var r = new ARM.Simulator.BinaryReader([0x00, 0xFF]);
        expect(r.ReadInt16()).toBe(-256);
        r.Seek(0);
        expect(r.ReadInt16(true)).toBe(0xFF);
        r.Seek(0);
        expect(r.ReadUint16()).toBe(0xFF00);
        r.Seek(0);
        expect(r.ReadUint16(true)).toBe(0xFF);
    });
    it('Read Ints', function () {
        var r = new ARM.Simulator.BinaryReader([0x23, 0x45, 0x67, 0x89]);
        expect(r.ReadInt32()).toBe(0x89674523 .toInt32());
        r.Seek(0);
        expect(r.ReadInt32(true)).toBe(0x23456789);
        r.Seek(0);
        expect(r.ReadUint32()).toBe(0x89674523);
        r.Seek(0);
        expect(r.ReadUint32(true)).toBe(0x23456789);
    });
    it('Can Seek', function () {
        var r = new ARM.Simulator.BinaryReader([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(r.Position).toBe(0);
        r.Seek(4);
        expect(r.Position).toBe(4);
        r.Seek(0);
        expect(r.Position).toBe(0);
        expect(function () { return r.Seek(100); }).toThrowError('Eof');
    });
});
describe('CPU Tests', function () {
    var cpu;
    var read = null;
    var write = null;
    var clockRate = 6.9824;
    var _cpu;
    var initCode = [
        0xea00000c,
        0xea000005,
        0xea000005,
        0xea000005,
        0xea000005,
        0xe1a00000,
        0xea000004,
        0xea000004,
        0xeafffffe,
        0xeafffffe,
        0xeafffffe,
        0xeafffffe,
        0xeafffffe,
        0xeafffffe
    ];
    var resetLabel = 0x38;
    beforeAll(function () {
        jasmine.clock().install();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        cpu = new ARM.Simulator.Cpu(clockRate, function (a, t) {
            if (read != null)
                return read(a, t);
            throw new Error('Could not read data at ' + a);
        }, function (a, t, v) {
            if (write != null)
                write(a, t, v);
            else
                throw new Error('Could not write data at ' + a);
        });
        _cpu = cpu;
    });
    afterEach(function () {
        read = null;
        write = null;
    });
    it('Reset Values', function () {
        expect(_cpu.pc).toBe(0);
        expect(_cpu.state).toBe(ARM.Simulator.CpuState.ARM);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        expect(_cpu.cpsr.I).toBe(true);
        expect(_cpu.cpsr.F).toBe(true);
    });
    it('Opcode Decoding', function () {
        var pairs = [
            [0xe0904002, _cpu.data],
            [0xe0a15003, _cpu.data],
            [0xe280001a, _cpu.data],
            [0xe1510000, _cpu.data],
            [0xeb000001, _cpu.b_bl],
            [0xe12fff1e, _cpu.bx],
            [0xe3c99003, _cpu.data],
            [0xee070f9a, _cpu.mrc_mcr],
            [0xe59f2038, _cpu.ldr_str],
            [0xe129f000, _cpu.msr],
            [0xee080f17, _cpu.mrc_mcr],
            [0xe59f2038, _cpu.ldr_str],
            [0xe3c33001, _cpu.data],
            [0xee013f10, _cpu.mrc_mcr],
            [0xe1a0f002, _cpu.data],
            [0xe59fc02c, _cpu.ldr_str],
            [0xe3a000f3, _cpu.data],
            [0xe58c001f, _cpu.ldr_str],
            [0xebfffffe, _cpu.b_bl],
            [0xeafffffe, _cpu.b_bl],
            [0xe5901000, _cpu.ldr_str],
            [0xe3510000, _cpu.data],
            [0x1a000000, _cpu.b_bl],
            [0xe5801000, _cpu.ldr_str],
            [0xe5901008, _cpu.ldr_str],
            [0xe590200c, _cpu.ldr_str],
            [0xe4d13001, _cpu.ldr_str],
            [0x00000058, _cpu.data],
            [0x00001341, _cpu.data],
            [0x61750100, _cpu.data],
            [0x01100962, _cpu.data],
            [0x00000009, _cpu.data],
            [0x01180306, _cpu.data]
        ];
        for (var _i = 0, pairs_1 = pairs; _i < pairs_1.length; _i++) {
            var p = pairs_1[_i];
            expect(_cpu.Decode(p[0])).toBe(p[1]);
        }
    });
    it('Reset Instruction Fetch', function () {
        read = function (a) {
            expect(a).toBe(0x00000000);
            return 0;
        };
        cpu.Step();
    });
    it('Undefined Instruction', function () {
        var rom = initCode.concat([
            0xFF000000
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        cpu.Step();
        expect(_cpu.pc).toBe(0x00000004);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Undefined);
    });
    it('Software Interrupt', function () {
        var rom = initCode.concat([
            0xef00000f
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        cpu.Step();
        expect(_cpu.pc).toBe(0x00000008);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        var address = _cpu.gpr[14] - 4;
        expect(rom[address / 4]).toBe(0xef00000f);
    });
    it('Data Abort', function () {
        var abortInst = 0xe5901000;
        var rom = initCode.concat([
            0xe51f0000,
            abortInst,
            0x12345678
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            if (a >= rom.length * 4)
                throw new Error('BadAddress');
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        cpu.Step();
        expect(_cpu.gpr[0]).toBe(0x12345678);
        cpu.Step();
        var dataAbortVector = 0x00000010;
        expect(_cpu.pc).toBe(dataAbortVector);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Abort);
        var address = _cpu.gpr[14] - 8;
        expect(rom[address / 4]).toBe(abortInst);
    });
    it('Fast Interrupt Request', function () {
        var rom = initCode.concat([
            0xe10f1000,
            0xe3c11040,
            0xe121f001,
            0xe0a15003,
            0xe280001a,
            0xe1510000
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        expect(_cpu.cpsr.F).toBe(true);
        for (var i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.cpsr.F).toBe(false);
        cpu.Step();
        cpu.nFIQ = false;
        var fiqVector = 0x0000001C;
        cpu.Step();
        expect(_cpu.pc).toBe(fiqVector);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.FIQ);
        expect(_cpu.cpsr.F).toBe(true);
        expect(_cpu.cpsr.I).toBe(true);
    });
    it('Interrupt Request', function () {
        var rom = initCode.concat([
            0xe10f1000,
            0xe3c110c0,
            0xe121f001,
            0xe0a15003,
            0xe280001a,
            0xe1510000
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        expect(_cpu.cpsr.I).toBe(true);
        expect(_cpu.cpsr.F).toBe(true);
        for (var i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.cpsr.I).toBe(false);
        expect(_cpu.cpsr.F).toBe(false);
        cpu.Step();
        cpu.nIRQ = false;
        var irqVector = 0x00000018;
        cpu.Step();
        expect(_cpu.pc).toBe(irqVector);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.IRQ);
        expect(_cpu.cpsr.I).toBe(true);
        expect(_cpu.cpsr.F).toBe(false);
    });
    it('Mode Switch', function () {
        var rom = initCode.concat([
            0xe10f3000,
            0xe383301f,
            0xe129f003,
            0xe10f3000,
            0xe3c3301f,
            0xe3833010,
            0xe129f003,
            0xe10f3000,
            0xe3c3301f,
            0xe3833013,
            0xe129f003
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        for (var i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.System);
        for (var i = 0; i < 4; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.User);
        for (var i = 0; i < 4; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.User);
    });
    it('Register Banking', function () {
        var sp_svc = 0x87654321;
        var sp_usr = 0x11112222;
        var rom = initCode.concat([
            0xe59fd01c,
            0xe10f3000,
            0xe383301f,
            0xe129f003,
            0xe59fd010,
            0xe10f3000,
            0xe3c3301f,
            0xe3833010,
            0xe129f003,
            0x87654321,
            0x11112222
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        cpu.Step();
        expect(_cpu.gpr[13]).toBe(sp_svc);
        for (var i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.System);
        expect(_cpu.gpr[13]).not.toBe(sp_svc);
        cpu.Step();
        expect(_cpu.gpr[13]).toBe(sp_usr);
        for (var i = 0; i < 4; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.User);
        expect(_cpu.gpr[13]).toBe(sp_usr);
    });
    it('Addition Overflow', function () {
        var rom = initCode.concat([
            0xe3e01000,
            0xe3a02001,
            0xe0910002
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        for (var i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.cpsr.N).toBe(false);
        expect(_cpu.cpsr.Z).toBe(true);
        expect(_cpu.cpsr.C).toBe(true);
        expect(_cpu.cpsr.V).toBe(false);
    });
    it('Integer Arithmetic #1', function () {
        var rom = initCode.concat([
            0xe3a00007,
            0xe3a01000,
            0xe2811001,
            0xe2104001,
            0x0a000002,
            0xe0800080,
            0xe2800001,
            0xeafffff9,
            0xe1a000c0,
            0xe2507001,
            0x1afffff6,
            0xe51fa000,
            0xe58a0000,
            0x12345678
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        var stopRunning = false;
        write = function (a) {
            expect(a).toBe(0x12345678);
            stopRunning = true;
        };
        while (!stopRunning)
            cpu.Step();
        var expectedIterations = 16;
        expect(_cpu.gpr[1]).toBe(expectedIterations);
    });
    it('Integer Arithmetic #2', function () {
        var rom = initCode.concat([
            0xe59f0034,
            0xe3a01000,
            0xe3a02419,
            0xe3822899,
            0xe3822c99,
            0xe382209a,
            0xe3a0300a,
            0xe0854290,
            0xe0864395,
            0xe0404004,
            0xe0811004,
            0xe1b00005,
            0x1afffff9,
            0xe51fa000,
            0xe58a0000,
            0x12345678
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        var stopRunning = false;
        write = function (a) {
            expect(a).toBe(0x12345678);
            stopRunning = true;
        };
        while (!stopRunning)
            cpu.Step();
        var expectedResult = 45;
        expect(_cpu.gpr[1]).toBe(expectedResult);
    });
    it('Branch and Link', function () {
        var rom = initCode.concat([
            0xe3a0000a,
            0xe3a01003,
            0xeb000002,
            0xe3a02018,
            0xe59f3008,
            0xe5830000,
            0xe0800001,
            0xe12fff1e,
            0x12345678
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        var stopRunning = false;
        write = function (a) {
            expect(a).toBe(0x12345678);
            stopRunning = true;
        };
        while (!stopRunning)
            cpu.Step();
        var expectedResult = 13;
        expect(_cpu.gpr[0]).toBe(expectedResult);
        expect(_cpu.gpr[2]).toBe(24);
    });
});
describe('DS1307 Tests', function () {
    var rtc;
    var service;
    beforeAll(function () {
        jasmine.clock().install();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        rtc = new ARM.Simulator.Devices.DS1307(0, new Date());
        service = new ARM.Simulator.Tests.MockService();
        expect(rtc.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        rtc.OnUnregister();
    });
    var tick = function (ms) {
        jasmine.clock().tick(ms);
    };
    var expectEvent = function (event, properties, numTimes) {
        if (properties === void 0) { properties = null; }
        if (numTimes === void 0) { numTimes = 1; }
        for (var i = 0; i < numTimes; i++) {
            expect(service.RaisedEvents.length).toBeGreaterThan(0);
            var ev = service.RaisedEvents.pop();
            expect(ev[0]).toBe(event);
            if (properties != null) {
                for (var key in properties) {
                    if (!properties.hasOwnProperty(key))
                        continue;
                    expect(ev[1][key]).toBeDefined();
                    expect(ev[1][key]).toBe(properties[key]);
                }
            }
        }
    };
    it('BCD Conversion', function () {
        var pairs = [
            [23, 0x23],
            [18, 0x18],
            [0, 0x00],
            [9, 0x09],
            [10, 0x10]
        ];
        for (var _i = 0, pairs_2 = pairs; _i < pairs_2.length; _i++) {
            var p = pairs_2[_i];
            expect(ARM.Simulator.Devices.DS1307.ToBCD(p[0])).toBe(p[1]);
            expect(ARM.Simulator.Devices.DS1307.FromBCD(p[1])).toBe(p[0]);
        }
    });
    it('Tick Tock', function () {
        expect(service.RaisedEvents.length).toBe(0);
        tick(5210);
        expectEvent('DS1307.Tick', null, 5);
    });
    it('Oscillator Enable/Disable', function () {
        expect(service.RaisedEvents.length).toBe(0);
        tick(43284);
        expectEvent('DS1307.Tick', null, 43);
        var secondsRegister = rtc.Read(0, ARM.Simulator.DataType.Byte);
        secondsRegister |= (1 << 7);
        rtc.Write(0, ARM.Simulator.DataType.Byte, secondsRegister);
        expectEvent('DS1307.DataWrite');
        expect(service.RaisedEvents.length).toBe(0);
        tick(67801);
        expect(service.RaisedEvents.length).toBe(0);
        secondsRegister &= ~(1 << 7);
        rtc.Write(0, ARM.Simulator.DataType.Byte, secondsRegister);
        tick(92549);
        expectEvent('DS1307.Tick', null, 92);
        expectEvent('DS1307.DataWrite');
    });
    it('Set/Get Time', function () {
        var values = [
            0x00,
            0x24,
            0x03,
            0x05,
            0x17,
            0x12,
            0x15
        ];
        for (var i = 0; i < values.length; i++)
            rtc.Write(i, ARM.Simulator.DataType.Byte, values[i]);
        expectEvent('DS1307.DataWrite', null, values.length);
        tick(1000 * 60 * 60 * 36);
        var expected = [0x00, 0x24, 0x15, 0x06, 0x18, 0x12, 0x15];
        for (var i = 0; i < expected.length; i++)
            expect(rtc.Read(i, ARM.Simulator.DataType.Byte)).toBe(expected[i]);
    });
    it('12-Hour Mode', function () {
        var values = [
            0x12,
            0x51,
            0x02 | (1 << 6) | (1 << 5),
            0x01,
            0x28,
            0x09,
            0x14
        ];
        for (var i = 0; i < values.length; i++)
            rtc.Write(i, ARM.Simulator.DataType.Byte, values[i]);
        expectEvent('DS1307.DataWrite', null, values.length);
        tick(1000 * 60 * 60 * 20);
        var expected = [0x12, 0x51,
            0x10 | (1 << 6),
            0x02, 0x29, 0x09, 0x14];
        for (var i = 0; i < expected.length; i++)
            expect(rtc.Read(i, ARM.Simulator.DataType.Byte)).toBe(expected[i]);
        tick(1000 * 60 * 60 * 2);
        var expectedHours = 0x12 | (1 << 6) | (1 << 5);
        expect(rtc.Read(2, ARM.Simulator.DataType.Byte)).toBe(expectedHours);
    });
});
describe('ELF Loader Tests', function () {
    var ARM32Elf = [
        0x7F, 0x45, 0x4C, 0x46, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x28, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x34, 0x00,
        0x00, 0x00, 0x24, 0x07, 0x00, 0x00, 0x00, 0x02, 0x00, 0x05,
        0x34, 0x00, 0x20, 0x00, 0x02, 0x00, 0x28, 0x00, 0x09, 0x00,
        0x06, 0x00, 0x01, 0x00, 0x00, 0x00, 0x74, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xCB, 0x01,
        0x00, 0x00, 0xCB, 0x01, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x40, 0x02,
        0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x04, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x06, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x0C, 0x00, 0x00, 0xEA,
        0x05, 0x00, 0x00, 0xEA, 0x05, 0x00, 0x00, 0xEA, 0x05, 0x00,
        0x00, 0xEA, 0x05, 0x00, 0x00, 0xEA, 0x00, 0x00, 0xA0, 0xE1,
        0x04, 0x00, 0x00, 0xEA, 0x04, 0x00, 0x00, 0xEA, 0xFE, 0xFF,
        0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA,
        0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF,
        0xFF, 0xEA, 0x00, 0x00, 0xA0, 0xE3, 0x28, 0x10, 0x9F, 0xE5,
        0x28, 0x20, 0x9F, 0xE5, 0x02, 0x00, 0x51, 0xE1, 0x01, 0x00,
        0x00, 0x0A, 0x01, 0x00, 0xC1, 0xE4, 0xFB, 0xFF, 0xFF, 0xEA,
        0x12, 0x09, 0xA0, 0xE3, 0x00, 0xD0, 0xA0, 0xE1, 0x44, 0x00,
        0x00, 0xEB, 0x0C, 0x00, 0x9F, 0xE5, 0x01, 0x10, 0xA0, 0xE3,
        0x00, 0x10, 0xC0, 0xE5, 0x04, 0x00, 0x04, 0x00, 0x04, 0x00,
        0x04, 0x00, 0x00, 0xC0, 0x1F, 0xE0, 0x04, 0xB0, 0x2D, 0xE5,
        0x00, 0xB0, 0x8D, 0xE2, 0x4E, 0x32, 0xA0, 0xE3, 0x00, 0x20,
        0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5, 0xCE, 0x32, 0xA0, 0xE3,
        0x80, 0x20, 0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5, 0x0E, 0x32,
        0xA0, 0xE3, 0x03, 0x20, 0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5,
        0x4E, 0x32, 0xA0, 0xE3, 0x00, 0x20, 0xA0, 0xE3, 0x00, 0x20,
        0x83, 0xE5, 0xCE, 0x32, 0xA0, 0xE3, 0x03, 0x20, 0xA0, 0xE3,
        0x00, 0x20, 0x83, 0xE5, 0x8E, 0x32, 0xA0, 0xE3, 0xC7, 0x20,
        0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5, 0x00, 0x00, 0xA0, 0xE1,
        0x00, 0xD0, 0x4B, 0xE2, 0x04, 0xB0, 0x9D, 0xE4, 0x1E, 0xFF,
        0x2F, 0xE1, 0x04, 0xB0, 0x2D, 0xE5, 0x00, 0xB0, 0x8D, 0xE2,
        0x0C, 0xD0, 0x4D, 0xE2, 0x00, 0x30, 0xA0, 0xE1, 0x05, 0x30,
        0x4B, 0xE5, 0x00, 0x00, 0xA0, 0xE1, 0x28, 0x30, 0x9F, 0xE5,
        0x00, 0x30, 0x93, 0xE5, 0x20, 0x30, 0x03, 0xE2, 0x00, 0x00,
        0x53, 0xE3, 0xFA, 0xFF, 0xFF, 0x0A, 0x0E, 0x22, 0xA0, 0xE3,
        0x05, 0x30, 0x5B, 0xE5, 0x00, 0x30, 0x82, 0xE5, 0x00, 0x00,
        0xA0, 0xE1, 0x00, 0xD0, 0x4B, 0xE2, 0x04, 0xB0, 0x9D, 0xE4,
        0x1E, 0xFF, 0x2F, 0xE1, 0x14, 0x00, 0x00, 0xE0, 0x00, 0x48,
        0x2D, 0xE9, 0x04, 0xB0, 0x8D, 0xE2, 0x08, 0xD0, 0x4D, 0xE2,
        0x08, 0x00, 0x0B, 0xE5, 0x06, 0x00, 0x00, 0xEA, 0x08, 0x30,
        0x1B, 0xE5, 0x00, 0x30, 0xD3, 0xE5, 0x03, 0x00, 0xA0, 0xE1,
        0xE3, 0xFF, 0xFF, 0xEB, 0x08, 0x30, 0x1B, 0xE5, 0x01, 0x30,
        0x83, 0xE2, 0x08, 0x30, 0x0B, 0xE5, 0x08, 0x30, 0x1B, 0xE5,
        0x00, 0x30, 0xD3, 0xE5, 0x00, 0x00, 0x53, 0xE3, 0xF4, 0xFF,
        0xFF, 0x1A, 0x00, 0x00, 0xA0, 0xE1, 0x04, 0xD0, 0x4B, 0xE2,
        0x00, 0x48, 0xBD, 0xE8, 0x1E, 0xFF, 0x2F, 0xE1, 0x00, 0x48,
        0x2D, 0xE9, 0x04, 0xB0, 0x8D, 0xE2, 0xBD, 0xFF, 0xFF, 0xEB,
        0x48, 0x00, 0xA0, 0xE3, 0xD3, 0xFF, 0xFF, 0xEB, 0x61, 0x00,
        0xA0, 0xE3, 0xD1, 0xFF, 0xFF, 0xEB, 0x00, 0x30, 0xA0, 0xE3,
        0x03, 0x00, 0xA0, 0xE1, 0x04, 0xD0, 0x4B, 0xE2, 0x00, 0x48,
        0xBD, 0xE8, 0x1E, 0xFF, 0x2F, 0xE1, 0x48, 0x65, 0x6C, 0x6C,
        0x6F, 0x20, 0x57, 0x6F, 0x72, 0x6C, 0x64, 0x20, 0x69, 0x73,
        0x20, 0x74, 0x68, 0x69, 0x73, 0x20, 0x68, 0x6F, 0x77, 0x20,
        0x69, 0x74, 0x20, 0x77, 0x6F, 0x72, 0x6B, 0x73, 0x20, 0x65,
        0x76, 0x65, 0x6E, 0x3F, 0x00, 0x00, 0xA4, 0x01, 0x00, 0x00,
        0x41, 0x2B, 0x00, 0x00, 0x00, 0x61, 0x65, 0x61, 0x62, 0x69,
        0x00, 0x01, 0x21, 0x00, 0x00, 0x00, 0x05, 0x41, 0x52, 0x4D,
        0x37, 0x54, 0x44, 0x4D, 0x49, 0x00, 0x06, 0x02, 0x08, 0x01,
        0x09, 0x01, 0x12, 0x04, 0x14, 0x01, 0x15, 0x01, 0x17, 0x03,
        0x18, 0x01, 0x1A, 0x01, 0x47, 0x43, 0x43, 0x3A, 0x20, 0x28,
        0x47, 0x4E, 0x55, 0x20, 0x54, 0x6F, 0x6F, 0x6C, 0x73, 0x20,
        0x66, 0x6F, 0x72, 0x20, 0x41, 0x52, 0x4D, 0x20, 0x45, 0x6D,
        0x62, 0x65, 0x64, 0x64, 0x65, 0x64, 0x20, 0x50, 0x72, 0x6F,
        0x63, 0x65, 0x73, 0x73, 0x6F, 0x72, 0x73, 0x29, 0x20, 0x35,
        0x2E, 0x33, 0x2E, 0x31, 0x20, 0x32, 0x30, 0x31, 0x36, 0x30,
        0x33, 0x30, 0x37, 0x20, 0x28, 0x72, 0x65, 0x6C, 0x65, 0x61,
        0x73, 0x65, 0x29, 0x20, 0x5B, 0x41, 0x52, 0x4D, 0x2F, 0x65,
        0x6D, 0x62, 0x65, 0x64, 0x64, 0x65, 0x64, 0x2D, 0x35, 0x2D,
        0x62, 0x72, 0x61, 0x6E, 0x63, 0x68, 0x20, 0x72, 0x65, 0x76,
        0x69, 0x73, 0x69, 0x6F, 0x6E, 0x20, 0x32, 0x33, 0x34, 0x35,
        0x38, 0x39, 0x5D, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
        0x00, 0x00, 0xA4, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x03, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x03, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00,
        0x05, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0xF1, 0xFF, 0x0B, 0x00,
        0x00, 0x00, 0x38, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x1A, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x1D, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x30, 0x00, 0x00, 0x00,
        0x24, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x42, 0x00, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x54, 0x00,
        0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x62, 0x00, 0x00, 0x00, 0x30, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x6F, 0x00, 0x00, 0x00, 0x34, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x7C, 0x00, 0x00, 0x00,
        0x38, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x84, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x87, 0x00,
        0x00, 0x00, 0x54, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x8A, 0x00, 0x00, 0x00, 0x00, 0xC0,
        0x1F, 0xE0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF1, 0xFF,
        0x9C, 0x00, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0xF1, 0xFF, 0xA5, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xF1, 0xFF, 0xAE, 0x00, 0x00, 0x00, 0x00, 0x80, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF1, 0xFF, 0xB7, 0x00,
        0x00, 0x00, 0x60, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0xBD, 0x00, 0x00, 0x00, 0x6C, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x04, 0x00, 0xF1, 0xFF, 0x1A, 0x00, 0x00, 0x00,
        0x78, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0xBD, 0x00, 0x00, 0x00, 0x20, 0x01, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x1A, 0x00,
        0x00, 0x00, 0x24, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0xBD, 0x00, 0x00, 0x00, 0xA4, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00,
        0xBD, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0xCE, 0x00, 0x00, 0x00,
        0xD8, 0x00, 0x00, 0x00, 0x4C, 0x00, 0x00, 0x00, 0x12, 0x00,
        0x01, 0x00, 0xFD, 0x00, 0x00, 0x00, 0x04, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x03, 0x00, 0xD7, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x04, 0x00, 0x00, 0x00,
        0x11, 0x00, 0x03, 0x00, 0xDC, 0x00, 0x00, 0x00, 0x04, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x03, 0x00,
        0xEA, 0x00, 0x00, 0x00, 0x78, 0x00, 0x00, 0x00, 0x60, 0x00,
        0x00, 0x00, 0x12, 0x00, 0x01, 0x00, 0xF3, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0x01, 0x00, 0xFC, 0x00, 0x00, 0x00, 0x04, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x03, 0x00, 0x08, 0x01,
        0x00, 0x00, 0x04, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x10, 0x00, 0x03, 0x00, 0x0E, 0x01, 0x00, 0x00, 0x04, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x03, 0x00,
        0x1A, 0x01, 0x00, 0x00, 0x74, 0x01, 0x00, 0x00, 0x30, 0x00,
        0x00, 0x00, 0x12, 0x00, 0x01, 0x00, 0x1F, 0x01, 0x00, 0x00,
        0x24, 0x01, 0x00, 0x00, 0x50, 0x00, 0x00, 0x00, 0x12, 0x00,
        0x01, 0x00, 0x28, 0x01, 0x00, 0x00, 0x04, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x03, 0x00, 0x09, 0x01,
        0x00, 0x00, 0x04, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x10, 0x00, 0x03, 0x00, 0x2F, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x03, 0x00,
        0x00, 0x73, 0x74, 0x61, 0x72, 0x74, 0x75, 0x70, 0x2E, 0x6F,
        0x00, 0x52, 0x65, 0x73, 0x65, 0x74, 0x45, 0x78, 0x63, 0x65,
        0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00, 0x24, 0x61, 0x00, 0x55,
        0x6E, 0x64, 0x65, 0x66, 0x69, 0x6E, 0x65, 0x64, 0x45, 0x78,
        0x63, 0x65, 0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00, 0x53, 0x6F,
        0x66, 0x74, 0x77, 0x61, 0x72, 0x65, 0x45, 0x78, 0x63, 0x65,
        0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00, 0x50, 0x72, 0x65, 0x66,
        0x65, 0x74, 0x63, 0x68, 0x45, 0x78, 0x63, 0x65, 0x70, 0x74,
        0x69, 0x6F, 0x6E, 0x00, 0x44, 0x61, 0x74, 0x61, 0x45, 0x78,
        0x63, 0x65, 0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00, 0x49, 0x52,
        0x51, 0x45, 0x78, 0x63, 0x65, 0x70, 0x74, 0x69, 0x6F, 0x6E,
        0x00, 0x46, 0x49, 0x51, 0x45, 0x78, 0x63, 0x65, 0x70, 0x74,
        0x69, 0x6F, 0x6E, 0x00, 0x7A, 0x65, 0x72, 0x6F, 0x62, 0x73,
        0x73, 0x00, 0x6C, 0x31, 0x00, 0x6C, 0x32, 0x00, 0x50, 0x4F,
        0x57, 0x45, 0x52, 0x5F, 0x43, 0x4F, 0x4E, 0x54, 0x52, 0x4F,
        0x4C, 0x5F, 0x52, 0x45, 0x47, 0x00, 0x52, 0x41, 0x4D, 0x5F,
        0x53, 0x69, 0x7A, 0x65, 0x00, 0x52, 0x41, 0x4D, 0x5F, 0x42,
        0x61, 0x73, 0x65, 0x00, 0x54, 0x6F, 0x70, 0x53, 0x74, 0x61,
        0x63, 0x6B, 0x00, 0x5F, 0x65, 0x78, 0x69, 0x74, 0x00, 0x24,
        0x64, 0x00, 0x69, 0x6E, 0x74, 0x65, 0x67, 0x72, 0x61, 0x74,
        0x69, 0x6F, 0x6E, 0x2E, 0x63, 0x00, 0x73, 0x69, 0x6F, 0x5F,
        0x70, 0x75, 0x74, 0x63, 0x00, 0x67, 0x6C, 0x6F, 0x62, 0x00,
        0x5F, 0x5F, 0x62, 0x73, 0x73, 0x5F, 0x73, 0x74, 0x61, 0x72,
        0x74, 0x5F, 0x5F, 0x00, 0x73, 0x69, 0x6F, 0x5F, 0x69, 0x6E,
        0x69, 0x74, 0x00, 0x5F, 0x73, 0x74, 0x61, 0x72, 0x74, 0x75,
        0x70, 0x00, 0x5F, 0x5F, 0x62, 0x73, 0x73, 0x5F, 0x65, 0x6E,
        0x64, 0x5F, 0x5F, 0x00, 0x5F, 0x5F, 0x65, 0x6E, 0x64, 0x00,
        0x5F, 0x5F, 0x62, 0x73, 0x73, 0x5F, 0x73, 0x74, 0x61, 0x72,
        0x74, 0x00, 0x6D, 0x61, 0x69, 0x6E, 0x00, 0x73, 0x69, 0x6F,
        0x5F, 0x70, 0x75, 0x74, 0x73, 0x00, 0x5F, 0x65, 0x64, 0x61,
        0x74, 0x61, 0x00, 0x5F, 0x5F, 0x64, 0x61, 0x74, 0x61, 0x5F,
        0x73, 0x74, 0x61, 0x72, 0x74, 0x00, 0x00, 0x2E, 0x73, 0x79,
        0x6D, 0x74, 0x61, 0x62, 0x00, 0x2E, 0x73, 0x74, 0x72, 0x74,
        0x61, 0x62, 0x00, 0x2E, 0x73, 0x68, 0x73, 0x74, 0x72, 0x74,
        0x61, 0x62, 0x00, 0x2E, 0x74, 0x65, 0x78, 0x74, 0x00, 0x2E,
        0x72, 0x6F, 0x64, 0x61, 0x74, 0x61, 0x00, 0x2E, 0x64, 0x61,
        0x74, 0x61, 0x00, 0x2E, 0x41, 0x52, 0x4D, 0x2E, 0x61, 0x74,
        0x74, 0x72, 0x69, 0x62, 0x75, 0x74, 0x65, 0x73, 0x00, 0x2E,
        0x63, 0x6F, 0x6D, 0x6D, 0x65, 0x6E, 0x74, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1B, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x74, 0x00, 0x00, 0x00, 0xA4, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00,
        0xA4, 0x01, 0x00, 0x00, 0x18, 0x02, 0x00, 0x00, 0x27, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x29, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x40, 0x02, 0x00, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2F, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x00, 0x70, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x44, 0x02, 0x00, 0x00, 0x2C, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3F, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x70, 0x02, 0x00, 0x00, 0x6E, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x11, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0xDC, 0x06, 0x00, 0x00, 0x48, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0xE0, 0x02, 0x00, 0x00, 0xC0, 0x02,
        0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x1E, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x09, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0xA0, 0x05, 0x00, 0x00, 0x3C, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ];
    var MIPSElf = [
        0x7F, 0x45, 0x4C, 0x46, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0xFF, 0x08, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x74, 0x03, 0x00, 0x00, 0x34, 0x00,
        0x00, 0x00, 0xF0, 0x06, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
        0x34, 0x00, 0x20, 0x00, 0x02, 0x00, 0x28, 0x00, 0x08, 0x00,
        0x07, 0x00, 0x80, 0x00, 0x00, 0x70, 0x74, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1B, 0x00,
        0x00, 0x00, 0x1B, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x90, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x30, 0x06, 0x00, 0x00, 0x90, 0x06, 0x00, 0x00, 0x07, 0x00,
        0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF,
        0x74, 0x03, 0x00, 0x00, 0x30, 0x86, 0x00, 0x00, 0x00, 0x05,
        0x00, 0x00, 0x30, 0x01, 0x00, 0x00, 0x60, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0xD8, 0xFF, 0xBD, 0x27, 0x20, 0x00,
        0xB4, 0xAF, 0x1C, 0x00, 0xB3, 0xAF, 0x18, 0x00, 0xB2, 0xAF,
        0x24, 0x00, 0xBF, 0xAF, 0x14, 0x00, 0xB1, 0xAF, 0x10, 0x00,
        0xB0, 0xAF, 0x00, 0x00, 0x83, 0x80, 0x30, 0x00, 0x02, 0x24,
        0x21, 0x98, 0x80, 0x00, 0x21, 0xA0, 0x00, 0x00, 0x25, 0x00,
        0x62, 0x10, 0x01, 0x00, 0x12, 0x24, 0x28, 0x01, 0x00, 0x0C,
        0x21, 0x20, 0x60, 0x02, 0xFF, 0xFF, 0x50, 0x24, 0x13, 0x00,
        0x00, 0x06, 0x21, 0x10, 0x80, 0x02, 0x21, 0x88, 0x70, 0x02,
        0x00, 0x00, 0x26, 0x82, 0x00, 0x00, 0x04, 0x3C, 0x00, 0x05,
        0x84, 0x24, 0x61, 0x00, 0xC2, 0x28, 0x21, 0x28, 0xC0, 0x00,
        0x13, 0x00, 0x40, 0x10, 0x41, 0x00, 0xC3, 0x28, 0x02, 0x00,
        0x60, 0x10, 0xC9, 0xFF, 0xC2, 0x24, 0xD0, 0xFF, 0xC2, 0x24,
        0x18, 0x00, 0x52, 0x00, 0xFF, 0xFF, 0x10, 0x26, 0x00, 0x91,
        0x12, 0x00, 0x12, 0x10, 0x00, 0x00, 0xF0, 0xFF, 0x01, 0x06,
        0x21, 0xA0, 0x82, 0x02, 0x21, 0x10, 0x80, 0x02, 0x24, 0x00,
        0xBF, 0x8F, 0x20, 0x00, 0xB4, 0x8F, 0x1C, 0x00, 0xB3, 0x8F,
        0x18, 0x00, 0xB2, 0x8F, 0x14, 0x00, 0xB1, 0x8F, 0x10, 0x00,
        0xB0, 0x8F, 0x08, 0x00, 0xE0, 0x03, 0x28, 0x00, 0xBD, 0x27,
        0x31, 0x01, 0x00, 0x0C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x23, 0x82, 0x1D, 0x00, 0x00, 0x08, 0xA9, 0xFF, 0x62, 0x24,
        0x01, 0x00, 0x83, 0x80, 0x78, 0x00, 0x02, 0x24, 0xD9, 0xFF,
        0x62, 0x14, 0x00, 0x00, 0x00, 0x00, 0x0D, 0x00, 0x00, 0x08,
        0x02, 0x00, 0x93, 0x24, 0xE8, 0xFF, 0xBD, 0x27, 0x00, 0x00,
        0x04, 0x3C, 0x04, 0x05, 0x84, 0x24, 0x10, 0x00, 0xBF, 0xAF,
        0x31, 0x01, 0x00, 0x0C, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0xBF, 0x8F, 0xFB, 0xFF, 0x02, 0x24, 0x08, 0x00, 0xE0, 0x03,
        0x18, 0x00, 0xBD, 0x27, 0xE8, 0xFF, 0xBD, 0x27, 0x00, 0x00,
        0x04, 0x3C, 0x14, 0x05, 0x84, 0x24, 0x10, 0x00, 0xBF, 0xAF,
        0x31, 0x01, 0x00, 0x0C, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0xBF, 0x8F, 0x21, 0x10, 0x00, 0x00, 0x08, 0x00, 0xE0, 0x03,
        0x18, 0x00, 0xBD, 0x27, 0xE0, 0xFF, 0xBD, 0x27, 0x14, 0x00,
        0xB1, 0xAF, 0x21, 0x88, 0x80, 0x00, 0x21, 0x20, 0xA0, 0x00,
        0x18, 0x00, 0xBF, 0xAF, 0x00, 0x00, 0x00, 0x0C, 0x10, 0x00,
        0xB0, 0xAF, 0x00, 0x00, 0x46, 0x8C, 0x00, 0x00, 0x04, 0x3C,
        0x28, 0x05, 0x84, 0x24, 0x21, 0x28, 0x40, 0x00, 0x31, 0x01,
        0x00, 0x0C, 0x21, 0x80, 0x40, 0x00, 0x1F, 0x00, 0x03, 0x3C,
        0xFF, 0xFF, 0x63, 0x34, 0x2A, 0x18, 0x70, 0x00, 0x00, 0x00,
        0x04, 0x3C, 0x50, 0x05, 0x84, 0x24, 0x0C, 0x00, 0x05, 0x24,
        0x14, 0x00, 0x60, 0x14, 0x21, 0x30, 0x00, 0x00, 0x1D, 0x01,
        0x00, 0x0C, 0x21, 0x20, 0x00, 0x00, 0x21, 0x18, 0x40, 0x00,
        0x00, 0x00, 0x04, 0x3C, 0x70, 0x05, 0x84, 0x24, 0x0D, 0x00,
        0x40, 0x10, 0x04, 0x00, 0x05, 0x26, 0x00, 0x00, 0x02, 0x8E,
        0x0C, 0x00, 0x23, 0xAE, 0x21, 0x20, 0x00, 0x00, 0x00, 0x00,
        0x62, 0xAC, 0x04, 0x00, 0x65, 0xAC, 0x08, 0x00, 0x60, 0xAC,
        0x18, 0x00, 0xBF, 0x8F, 0x14, 0x00, 0xB1, 0x8F, 0x10, 0x00,
        0xB0, 0x8F, 0x21, 0x10, 0x80, 0x00, 0x08, 0x00, 0xE0, 0x03,
        0x20, 0x00, 0xBD, 0x27, 0x31, 0x01, 0x00, 0x0C, 0x00, 0x00,
        0x00, 0x00, 0x6D, 0x00, 0x00, 0x08, 0xFE, 0xFF, 0x04, 0x24,
        0xE0, 0xFF, 0xBD, 0x27, 0x18, 0x00, 0xB2, 0xAF, 0x10, 0x00,
        0xB0, 0xAF, 0x1C, 0x00, 0xBF, 0xAF, 0x14, 0x00, 0xB1, 0xAF,
        0x0C, 0x00, 0x91, 0x8C, 0x21, 0x80, 0xA0, 0x00, 0x08, 0x00,
        0x23, 0x8E, 0x04, 0x00, 0x22, 0x8E, 0x00, 0x00, 0x04, 0x3C,
        0x90, 0x05, 0x84, 0x24, 0x21, 0x10, 0x43, 0x00, 0x21, 0x28,
        0x40, 0x00, 0x31, 0x01, 0x00, 0x0C, 0x21, 0x90, 0xC0, 0x00,
        0x08, 0x00, 0x27, 0x8E, 0x00, 0x00, 0x22, 0x8E, 0x00, 0x00,
        0x00, 0x00, 0x23, 0x10, 0x47, 0x00, 0x2A, 0x18, 0x52, 0x00,
        0x02, 0x00, 0x60, 0x10, 0x21, 0x20, 0x00, 0x02, 0x21, 0x90,
        0x40, 0x00, 0x04, 0x00, 0x25, 0x8E, 0x21, 0x30, 0x40, 0x02,
        0x26, 0x01, 0x00, 0x0C, 0x21, 0x28, 0xA7, 0x00, 0x08, 0x00,
        0x23, 0x8E, 0x21, 0x10, 0x40, 0x02, 0x21, 0x18, 0x72, 0x00,
        0x08, 0x00, 0x23, 0xAE, 0x1C, 0x00, 0xBF, 0x8F, 0x18, 0x00,
        0xB2, 0x8F, 0x14, 0x00, 0xB1, 0x8F, 0x10, 0x00, 0xB0, 0x8F,
        0x08, 0x00, 0xE0, 0x03, 0x20, 0x00, 0xBD, 0x27, 0xE0, 0xFF,
        0xBD, 0x27, 0x1C, 0x00, 0xBF, 0xAF, 0x18, 0x00, 0xB2, 0xAF,
        0x14, 0x00, 0xB1, 0xAF, 0x10, 0x00, 0xB0, 0xAF, 0x0C, 0x00,
        0x90, 0x8C, 0x21, 0x90, 0xA0, 0x00, 0x08, 0x00, 0x03, 0x8E,
        0x04, 0x00, 0x02, 0x8E, 0x00, 0x00, 0x04, 0x3C, 0xA8, 0x05,
        0x84, 0x24, 0x21, 0x10, 0x43, 0x00, 0x21, 0x28, 0x40, 0x00,
        0x31, 0x01, 0x00, 0x0C, 0x21, 0x88, 0xC0, 0x00, 0x04, 0x00,
        0x04, 0x8E, 0x08, 0x00, 0x02, 0x8E, 0x21, 0x28, 0x40, 0x02,
        0x21, 0x30, 0x20, 0x02, 0x26, 0x01, 0x00, 0x0C, 0x21, 0x20,
        0x82, 0x00, 0x08, 0x00, 0x03, 0x8E, 0x21, 0x10, 0x20, 0x02,
        0x21, 0x18, 0x71, 0x00, 0x08, 0x00, 0x03, 0xAE, 0x1C, 0x00,
        0xBF, 0x8F, 0x18, 0x00, 0xB2, 0x8F, 0x14, 0x00, 0xB1, 0x8F,
        0x10, 0x00, 0xB0, 0x8F, 0x08, 0x00, 0xE0, 0x03, 0x20, 0x00,
        0xBD, 0x27, 0xE0, 0xFF, 0xBD, 0x27, 0x18, 0x00, 0xB2, 0xAF,
        0x21, 0x90, 0xA0, 0x00, 0x14, 0x00, 0xB1, 0xAF, 0x21, 0x10,
        0x80, 0x00, 0x21, 0x88, 0xC0, 0x00, 0x1C, 0x00, 0xBF, 0xAF,
        0x10, 0x00, 0xB0, 0xAF, 0x21, 0x28, 0xC0, 0x00, 0x00, 0x00,
        0x04, 0x3C, 0xC0, 0x05, 0x84, 0x24, 0x0C, 0x00, 0x50, 0x8C,
        0x31, 0x01, 0x00, 0x0C, 0x21, 0x30, 0x40, 0x02, 0x11, 0x00,
        0x20, 0x12, 0x02, 0x00, 0x02, 0x24, 0x0C, 0x00, 0x22, 0x12,
        0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x05, 0x8E, 0x00, 0x00,
        0x04, 0x3C, 0x31, 0x01, 0x00, 0x0C, 0xE8, 0x05, 0x84, 0x24,
        0x08, 0x00, 0x02, 0x8E, 0x1C, 0x00, 0xBF, 0x8F, 0x18, 0x00,
        0xB2, 0x8F, 0x14, 0x00, 0xB1, 0x8F, 0x10, 0x00, 0xB0, 0x8F,
        0x08, 0x00, 0xE0, 0x03, 0x20, 0x00, 0xBD, 0x27, 0x00, 0x00,
        0x02, 0x8E, 0xCD, 0x00, 0x00, 0x08, 0x08, 0x00, 0x02, 0xAE,
        0xCD, 0x00, 0x00, 0x08, 0x08, 0x00, 0x12, 0xAE, 0x00, 0x00,
        0x02, 0x3C, 0x30, 0x06, 0x42, 0x24, 0x00, 0x00, 0x03, 0x3C,
        0x04, 0x01, 0x63, 0x24, 0x00, 0x00, 0x43, 0xAC, 0x00, 0x00,
        0x03, 0x3C, 0xDC, 0x01, 0x63, 0x24, 0xE8, 0xFF, 0xBD, 0x27,
        0x00, 0x00, 0x05, 0x3C, 0x2C, 0x01, 0xA5, 0x24, 0x14, 0x00,
        0x43, 0xAC, 0x00, 0x00, 0x03, 0x3C, 0xEC, 0x02, 0x63, 0x24,
        0x00, 0x00, 0x06, 0x3C, 0xDC, 0x00, 0xC6, 0x24, 0x00, 0x00,
        0x07, 0x3C, 0x04, 0x06, 0xE7, 0x24, 0x10, 0x00, 0xB0, 0xAF,
        0x0C, 0x00, 0x45, 0xAC, 0x00, 0x00, 0x10, 0x3C, 0x78, 0x06,
        0x10, 0x26, 0x00, 0x00, 0x05, 0x3C, 0x70, 0x02, 0xA5, 0x24,
        0x1C, 0x00, 0x43, 0xAC, 0x10, 0x00, 0x03, 0x24, 0x21, 0x20,
        0xE0, 0x00, 0x40, 0x00, 0x46, 0xAC, 0x04, 0x00, 0x03, 0xAE,
        0x04, 0x00, 0x46, 0xAC, 0x00, 0x00, 0x03, 0x3C, 0x08, 0x06,
        0x63, 0x24, 0x08, 0x00, 0x46, 0xAC, 0x10, 0x00, 0x46, 0xAC,
        0x20, 0x00, 0x46, 0xAC, 0x24, 0x00, 0x46, 0xAC, 0x28, 0x00,
        0x46, 0xAC, 0x2C, 0x00, 0x46, 0xAC, 0x30, 0x00, 0x46, 0xAC,
        0x34, 0x00, 0x46, 0xAC, 0x38, 0x00, 0x46, 0xAC, 0x3C, 0x00,
        0x46, 0xAC, 0x18, 0x00, 0x45, 0xAC, 0x01, 0x00, 0x05, 0x24,
        0x14, 0x00, 0xBF, 0xAF, 0x08, 0x00, 0x05, 0xAE, 0x0C, 0x00,
        0x03, 0xAE, 0x00, 0x00, 0x07, 0xAE, 0x3C, 0x01, 0x00, 0x0C,
        0x10, 0x00, 0x02, 0xAE, 0x3A, 0x01, 0x00, 0x0C, 0x21, 0x20,
        0x00, 0x02, 0x14, 0x00, 0xBF, 0x8F, 0x10, 0x00, 0xB0, 0x8F,
        0x21, 0x10, 0x00, 0x00, 0x08, 0x00, 0xE0, 0x03, 0x18, 0x00,
        0xBD, 0x27, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0x41, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x01, 0x00, 0x00, 0x73, 0x79, 0x73, 0x6D,
        0x65, 0x6D, 0x00, 0x00, 0x08, 0x00, 0xE0, 0x03, 0x04, 0x00,
        0x00, 0x24, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0xE0, 0x41, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01,
        0x00, 0x00, 0x73, 0x79, 0x73, 0x63, 0x6C, 0x69, 0x62, 0x00,
        0x08, 0x00, 0xE0, 0x03, 0x0C, 0x00, 0x00, 0x24, 0x08, 0x00,
        0xE0, 0x03, 0x1B, 0x00, 0x00, 0x24, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0x41, 0x00, 0x00,
        0x00, 0x00, 0x02, 0x01, 0x00, 0x00, 0x73, 0x74, 0x64, 0x69,
        0x6F, 0x00, 0x00, 0x00, 0x08, 0x00, 0xE0, 0x03, 0x04, 0x00,
        0x00, 0x24, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0xE0, 0x41, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01,
        0x00, 0x00, 0x69, 0x6F, 0x6D, 0x61, 0x6E, 0x00, 0x00, 0x00,
        0x08, 0x00, 0xE0, 0x03, 0x14, 0x00, 0x00, 0x24, 0x08, 0x00,
        0xE0, 0x03, 0x15, 0x00, 0x00, 0x24, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x25, 0x63, 0x0A, 0x00, 0x4D, 0x45,
        0x4D, 0x46, 0x53, 0x3A, 0x20, 0x64, 0x75, 0x6D, 0x6D, 0x79,
        0x0A, 0x00, 0x00, 0x00, 0x4D, 0x45, 0x4D, 0x46, 0x53, 0x3A,
        0x20, 0x49, 0x6E, 0x69, 0x74, 0x69, 0x61, 0x6C, 0x69, 0x7A,
        0x65, 0x64, 0x0A, 0x00, 0x4D, 0x45, 0x4D, 0x46, 0x53, 0x3A,
        0x20, 0x6F, 0x70, 0x65, 0x6E, 0x20, 0x30, 0x78, 0x25, 0x78,
        0x20, 0x28, 0x66, 0x69, 0x6C, 0x65, 0x73, 0x69, 0x7A, 0x65,
        0x3A, 0x20, 0x25, 0x69, 0x20, 0x62, 0x79, 0x74, 0x65, 0x73,
        0x29, 0x0A, 0x00, 0x00, 0x4D, 0x45, 0x4D, 0x46, 0x53, 0x3A,
        0x20, 0x49, 0x6E, 0x76, 0x61, 0x6C, 0x69, 0x64, 0x20, 0x6D,
        0x65, 0x6D, 0x6F, 0x72, 0x79, 0x20, 0x61, 0x64, 0x64, 0x72,
        0x65, 0x73, 0x73, 0x0A, 0x00, 0x00, 0x4D, 0x45, 0x4D, 0x46,
        0x53, 0x3A, 0x20, 0x41, 0x6C, 0x6C, 0x6F, 0x63, 0x53, 0x79,
        0x73, 0x4D, 0x65, 0x6D, 0x6F, 0x72, 0x79, 0x20, 0x66, 0x61,
        0x69, 0x6C, 0x65, 0x64, 0x0A, 0x00, 0x00, 0x00, 0x4D, 0x45,
        0x4D, 0x46, 0x53, 0x3A, 0x20, 0x72, 0x65, 0x61, 0x64, 0x20,
        0x61, 0x74, 0x20, 0x30, 0x78, 0x25, 0x78, 0x0A, 0x00, 0x00,
        0x00, 0x00, 0x4D, 0x45, 0x4D, 0x46, 0x53, 0x3A, 0x20, 0x77,
        0x72, 0x69, 0x74, 0x65, 0x20, 0x61, 0x74, 0x20, 0x30, 0x78,
        0x25, 0x78, 0x0A, 0x00, 0x00, 0x00, 0x4D, 0x45, 0x4D, 0x46,
        0x53, 0x3A, 0x20, 0x6C, 0x73, 0x65, 0x65, 0x6B, 0x20, 0x28,
        0x6D, 0x6F, 0x64, 0x65, 0x20, 0x3D, 0x20, 0x25, 0x69, 0x29,
        0x20, 0x28, 0x6F, 0x66, 0x66, 0x73, 0x65, 0x74, 0x20, 0x3D,
        0x20, 0x25, 0x69, 0x29, 0x0A, 0x00, 0x4D, 0x45, 0x4D, 0x46,
        0x53, 0x3A, 0x20, 0x6C, 0x73, 0x65, 0x65, 0x6B, 0x20, 0x72,
        0x65, 0x74, 0x75, 0x72, 0x6E, 0x69, 0x6E, 0x67, 0x20, 0x25,
        0x69, 0x0A, 0x00, 0x00, 0x6D, 0x65, 0x6D, 0x00, 0x49, 0x4F,
        0x50, 0x20, 0x4D, 0x65, 0x6D, 0x6F, 0x72, 0x79, 0x20, 0x46,
        0x69, 0x6C, 0x65, 0x20, 0x53, 0x79, 0x73, 0x74, 0x65, 0x6D,
        0x20, 0x44, 0x72, 0x69, 0x76, 0x65, 0x72, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2E,
        0x73, 0x68, 0x73, 0x74, 0x72, 0x74, 0x61, 0x62, 0x00, 0x2E,
        0x69, 0x6F, 0x70, 0x6D, 0x6F, 0x64, 0x00, 0x2E, 0x72, 0x65,
        0x6C, 0x2E, 0x74, 0x65, 0x78, 0x74, 0x00, 0x2E, 0x72, 0x6F,
        0x64, 0x61, 0x74, 0x61, 0x00, 0x2E, 0x64, 0x61, 0x74, 0x61,
        0x00, 0x2E, 0x62, 0x73, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0B, 0x00, 0x00, 0x00,
        0x80, 0x00, 0x00, 0x70, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x74, 0x00, 0x00, 0x00, 0x1B, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x17, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x90, 0x00, 0x00, 0x00, 0x00, 0x05, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x13, 0x00, 0x00, 0x00,
        0x09, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x30, 0x08, 0x00, 0x00, 0xE8, 0x01, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x1D, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x05,
        0x00, 0x00, 0x90, 0x05, 0x00, 0x00, 0x30, 0x01, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x25, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x30, 0x06,
        0x00, 0x00, 0xC0, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2B, 0x00, 0x00, 0x00,
        0x08, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x30, 0x06,
        0x00, 0x00, 0xC0, 0x06, 0x00, 0x00, 0x60, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
        0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0xC0, 0x06, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x34, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x50, 0x00, 0x00, 0x00, 0x05, 0x04,
        0x00, 0x00, 0x54, 0x00, 0x00, 0x00, 0x06, 0x04, 0x00, 0x00,
        0xB0, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xBC, 0x00,
        0x00, 0x00, 0x04, 0x02, 0x00, 0x00, 0xD4, 0x00, 0x00, 0x00,
        0x04, 0x02, 0x00, 0x00, 0xE0, 0x00, 0x00, 0x00, 0x05, 0x04,
        0x00, 0x00, 0xE4, 0x00, 0x00, 0x00, 0x06, 0x04, 0x00, 0x00,
        0xEC, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x08, 0x01,
        0x00, 0x00, 0x05, 0x04, 0x00, 0x00, 0x0C, 0x01, 0x00, 0x00,
        0x06, 0x04, 0x00, 0x00, 0x14, 0x01, 0x00, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x40, 0x01, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
        0x4C, 0x01, 0x00, 0x00, 0x05, 0x04, 0x00, 0x00, 0x50, 0x01,
        0x00, 0x00, 0x06, 0x04, 0x00, 0x00, 0x58, 0x01, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x6C, 0x01, 0x00, 0x00, 0x05, 0x04,
        0x00, 0x00, 0x70, 0x01, 0x00, 0x00, 0x06, 0x04, 0x00, 0x00,
        0x80, 0x01, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x8C, 0x01,
        0x00, 0x00, 0x05, 0x04, 0x00, 0x00, 0x90, 0x01, 0x00, 0x00,
        0x06, 0x04, 0x00, 0x00, 0xCC, 0x01, 0x00, 0x00, 0x04, 0x00,
        0x00, 0x00, 0xD4, 0x01, 0x00, 0x00, 0x04, 0x02, 0x00, 0x00,
        0x00, 0x02, 0x00, 0x00, 0x05, 0x04, 0x00, 0x00, 0x04, 0x02,
        0x00, 0x00, 0x06, 0x04, 0x00, 0x00, 0x10, 0x02, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x40, 0x02, 0x00, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x94, 0x02, 0x00, 0x00, 0x05, 0x04, 0x00, 0x00,
        0x98, 0x02, 0x00, 0x00, 0x06, 0x04, 0x00, 0x00, 0xA4, 0x02,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xBC, 0x02, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x10, 0x03, 0x00, 0x00, 0x05, 0x04,
        0x00, 0x00, 0x14, 0x03, 0x00, 0x00, 0x06, 0x04, 0x00, 0x00,
        0x1C, 0x03, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x38, 0x03,
        0x00, 0x00, 0x05, 0x04, 0x00, 0x00, 0x40, 0x03, 0x00, 0x00,
        0x06, 0x04, 0x00, 0x00, 0x3C, 0x03, 0x00, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x64, 0x03, 0x00, 0x00, 0x04, 0x02, 0x00, 0x00,
        0x6C, 0x03, 0x00, 0x00, 0x04, 0x02, 0x00, 0x00, 0x74, 0x03,
        0x00, 0x00, 0x05, 0x06, 0x00, 0x00, 0x78, 0x03, 0x00, 0x00,
        0x06, 0x06, 0x00, 0x00, 0x7C, 0x03, 0x00, 0x00, 0x05, 0x00,
        0x00, 0x00, 0x80, 0x03, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
        0x88, 0x03, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0x8C, 0x03,
        0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x94, 0x03, 0x00, 0x00,
        0x05, 0x00, 0x00, 0x00, 0x98, 0x03, 0x00, 0x00, 0x06, 0x00,
        0x00, 0x00, 0xA0, 0x03, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00,
        0xA4, 0x03, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0xA8, 0x03,
        0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0xAC, 0x03, 0x00, 0x00,
        0x06, 0x00, 0x00, 0x00, 0xB0, 0x03, 0x00, 0x00, 0x05, 0x04,
        0x00, 0x00, 0xB4, 0x03, 0x00, 0x00, 0x06, 0x04, 0x00, 0x00,
        0xC0, 0x03, 0x00, 0x00, 0x05, 0x06, 0x00, 0x00, 0xC4, 0x03,
        0x00, 0x00, 0x06, 0x06, 0x00, 0x00, 0xC8, 0x03, 0x00, 0x00,
        0x05, 0x00, 0x00, 0x00, 0xCC, 0x03, 0x00, 0x00, 0x06, 0x00,
        0x00, 0x00, 0xE8, 0x03, 0x00, 0x00, 0x05, 0x04, 0x00, 0x00,
        0xEC, 0x03, 0x00, 0x00, 0x06, 0x04, 0x00, 0x00, 0x30, 0x04,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x38, 0x04, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00,
        0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x03, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x03, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x30, 0x06,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x05, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x30, 0x06, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00,
        0x07, 0x00, 0x00
    ];
    it('Load 32-Bit ARM ELF', function () {
        var EF_ARM_ABIMASK = 0xFF000000, EF_ARM_BE8 = 0x00800000, EF_ARM_ABI_FLOAT_HARD = 0x00000400, EF_ARM_ABI_FLOAT_SOFT = 0x00000200;
        var elf = new ARM.Simulator.Elf.Elf32(ARM32Elf);
        expect(elf.Machine).toBe(ARM.Simulator.Elf.ElfMachine.Arm);
        expect(elf.Version).toBe(1);
        expect(elf.BigEndian).toBe(false);
        expect(elf.Type).toBe(ARM.Simulator.Elf.ElfType.Executable);
        expect(elf.Flags & EF_ARM_ABIMASK).toBe(0x05000000);
        expect(elf.Flags & EF_ARM_BE8).toBe(0);
        expect(elf.Flags & EF_ARM_ABI_FLOAT_HARD).toBe(0);
        expect(elf.Flags & EF_ARM_ABI_FLOAT_SOFT).toBe(EF_ARM_ABI_FLOAT_SOFT);
        expect(elf.Segments.length).toBe(2);
        expect(elf.Segments[0].Type).toBe(ARM.Simulator.Elf.ElfSegmentType.Load);
        expect(elf.Segments[0].VirtualAddress).toBe(0);
        expect(elf.Segments[1].Type).toBe(ARM.Simulator.Elf.ElfSegmentType.Load);
        expect(elf.Segments[1].VirtualAddress).toBe(0x40000);
    });
    it('Load 32-Bit MIPS ELF', function () {
        var ET_MIPS_IRX = 0xFF80, EF_MIPS_NOREORDER = 0x00000001, PT_MIPS_IOPMOD = 0x70000080;
        var elf = new ARM.Simulator.Elf.Elf32(MIPSElf);
        expect(elf.Machine).toBe(ARM.Simulator.Elf.ElfMachine.Mips);
        expect(elf.Version).toBe(1);
        expect(elf.BigEndian).toBe(false);
        expect(elf.Type).toBe(ET_MIPS_IRX);
        expect(elf.Flags).toBe(EF_MIPS_NOREORDER);
        expect(elf.EntryPoint).toBe(0x374);
        expect(elf.Segments.length).toBe(2);
        expect(elf.Segments[0].VirtualAddress).toBe(0);
        expect(elf.Segments[0].Offset).toBe(0x74);
        expect(elf.Segments[0].Type).toBe(PT_MIPS_IOPMOD);
        expect(elf.Segments[0].FileSize).toBe(0x1B);
        expect(elf.Segments[0].MemorySize).toBe(0x1B);
        expect(elf.Segments[0].Flags).toBe(ARM.Simulator.Elf.ElfSegmentFlag.Read);
        expect(elf.Segments[0].Alignment).toBe(0x4);
        expect(elf.Segments[1].VirtualAddress).toBe(0);
        expect(elf.Segments[1].Offset).toBe(0x90);
        expect(elf.Segments[1].Type).toBe(ARM.Simulator.Elf.ElfSegmentType.Load);
        expect(elf.Segments[1].FileSize).toBe(0x630);
        expect(elf.Segments[1].MemorySize).toBe(0x690);
        var rwx = ARM.Simulator.Elf.ElfSegmentFlag.Read | ARM.Simulator.Elf.ElfSegmentFlag.Write |
            ARM.Simulator.Elf.ElfSegmentFlag.Execute;
        expect(elf.Segments[1].Flags).toBe(rwx);
        expect(elf.Segments[1].Alignment).toBe(0x10);
    });
});
describe('GPIO Tests', function () {
    var gpio;
    var service;
    var read = null;
    var write = null;
    beforeAll(function () {
        jasmine.clock().install();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        gpio = new ARM.Simulator.Devices.GPIO(0, 2, function (p) {
            if (read)
                return read(p);
            return 0;
        }, function (p, v, s, c, d) {
            if (write)
                write(p, v, s, c, d);
        });
        service = new ARM.Simulator.Tests.MockService();
        expect(gpio.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        read = null;
        write = null;
        gpio.OnUnregister();
    });
    it('Reset Values', function () {
        var value = gpio.Read(0x04, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        value = gpio.Read(0x14, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
    });
    it('Read from I/O port', function () {
        var ports = [0x12345678, 0x87654321];
        read = function (p) {
            return ports[p];
        };
        var value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(ports[0]);
        value = gpio.Read(0x10, ARM.Simulator.DataType.Word);
        expect(value).toBe(ports[1]);
    });
    it('Write to I/O port', function () {
        var ports = [0, 0];
        write = function (p, v, s, c, d) {
            if (s)
                ports[p] |= v;
            if (c)
                ports[p] &= v;
        };
        read = function (p) {
            return ports[p];
        };
        var value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        gpio.Write(0x00, ARM.Simulator.DataType.Word, 0x12345678);
        value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(0x12345678);
        value = gpio.Read(0x10, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        gpio.Write(0x10, ARM.Simulator.DataType.Word, 0x44444444);
        value = gpio.Read(0x10, ARM.Simulator.DataType.Word);
        expect(value).toBe(0x44444444);
        value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(0x12345678);
    });
    it('Set Pin Direction', function () {
        var m = 0x407001;
        var clear = false;
        write = function (p, v, s, c, d) {
            if (!clear) {
                expect(s).toBe(true);
                expect(c).toBe(false);
                expect(d).toBe(m);
            }
            else {
                expect(s).toBe(false);
                expect(c).toBe(true);
                expect(v).toBe(0);
            }
        };
        var value = gpio.Read(0x04, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        gpio.Write(0x04, ARM.Simulator.DataType.Word, m);
        value = gpio.Read(0x04, ARM.Simulator.DataType.Word);
        expect(value).toBe(m);
        gpio.Write(0x08, ARM.Simulator.DataType.Word, m);
        clear = true;
        gpio.Write(0x0C, ARM.Simulator.DataType.Word, ~0);
    });
});
describe('HD44780U Tests', function () {
    var lcd;
    var service;
    beforeAll(function () {
        jasmine.clock().install();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        lcd = new ARM.Simulator.Devices.HD44780U(0);
        service = new ARM.Simulator.Tests.MockService();
        expect(lcd.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        lcd.OnUnregister();
    });
    var issueCommand = function (word, rw, rs) {
        if (rw === void 0) { rw = false; }
        if (rs === void 0) { rs = false; }
        var pattern = (rs ? 1 : 0) + (rw ? 2 : 0);
        var values = [
            [0x00, pattern | 0x04],
            [0x04, word],
            [0x00, pattern]
        ];
        for (var _i = 0, values_1 = values; _i < values_1.length; _i++) {
            var pair = values_1[_i];
            lcd.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
        }
    };
    var checkBusyFlag = function () {
        var values = [
            [0x00, 0x06],
            [0x00, 0x02]
        ];
        for (var _i = 0, values_2 = values; _i < values_2.length; _i++) {
            var pair = values_2[_i];
            lcd.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
        }
        var ret = lcd.Read(0x04, ARM.Simulator.DataType.Word);
        return ((ret >> 7) & 0x01) == 1;
    };
    var readAddressCounter = function () {
        var values = [
            [0x00, 0x06],
            [0x00, 0x02]
        ];
        for (var _i = 0, values_3 = values; _i < values_3.length; _i++) {
            var pair = values_3[_i];
            lcd.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
        }
        var ret = lcd.Read(0x04, ARM.Simulator.DataType.Word);
        return (ret & 0x7F);
    };
    var readRam = function () {
        issueCommand(0x00, true, true);
        tick(10);
        var ret = lcd.Read(0x04, ARM.Simulator.DataType.Word);
        return (ret & 0xFF);
    };
    var tick = function (ms) {
        jasmine.clock().tick(ms);
    };
    it('Busy Flag', function () {
        expect(checkBusyFlag()).toBe(false);
        issueCommand(0x30);
        expect(checkBusyFlag()).toBe(true);
        tick(10);
        expect(checkBusyFlag()).toBe(false);
    });
    it('Instruction Timings', function () {
        var expectedTime = .037;
        var returnHome = 1.52;
        var instructions = [
            0x04,
            0x08,
            0x10,
            0x30,
            0x40,
            0x80
        ];
        for (var _i = 0, instructions_1 = instructions; _i < instructions_1.length; _i++) {
            var inst = instructions_1[_i];
            issueCommand(inst);
            expect(checkBusyFlag()).toBe(true);
            tick(expectedTime * .5);
            expect(checkBusyFlag()).toBe(true);
            tick(expectedTime * .5 + .01);
            expect(checkBusyFlag()).toBe(false);
        }
        issueCommand(0x02);
        expect(checkBusyFlag()).toBe(true);
        tick(returnHome * .5);
        expect(checkBusyFlag()).toBe(true);
        tick(returnHome * .5 + .01);
        expect(checkBusyFlag()).toBe(false);
    });
    it('Clear Display', function () {
        var clearDisplayCmd = 0x01;
        issueCommand(clearDisplayCmd);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        var ev = service.RaisedEvents[0];
        expect(ev[0]).toBe('HD44780U.ClearDisplay');
        var args = ev[1];
        expect(args.addressCounter).toBeDefined();
        expect(args.addressCounter).toBe(0);
        expect(args.ddRam).toBeDefined();
        for (var _i = 0, _a = args.ddRam; _i < _a.length; _i++) {
            var i = _a[_i];
            expect(i).toBe(0x20);
        }
    });
    it('Return Home', function () {
        var returnHomeCmd = 0x02;
        issueCommand(returnHomeCmd);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        var ev = service.RaisedEvents[0];
        expect(ev[0]).toBe('HD44780U.ReturnHome');
        var args = ev[1];
        expect(args.addressCounter).toBeDefined();
        expect(args.addressCounter).toBe(0);
    });
    it('Entry Mode Set', function () {
        var entryModeSetCmd = 0x04;
        issueCommand(entryModeSetCmd);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        var ev = service.RaisedEvents[0];
        expect(ev[0]).toBe('HD44780U.EntryModeSet');
        var args = ev[1];
        expect(args.incrementAddressCounter).toBeDefined();
        expect(args.incrementAddressCounter).toBe(false);
        entryModeSetCmd = 0x06;
        issueCommand(entryModeSetCmd);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(1);
        ev = service.RaisedEvents[1];
        expect(ev[0]).toBe('HD44780U.EntryModeSet');
        args = ev[1];
        expect(args.incrementAddressCounter).toBeDefined();
        expect(args.incrementAddressCounter).toBe(true);
    });
    it('Display On/Off Control', function () {
        var dispControlCmd = 0x08;
        issueCommand(dispControlCmd);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        var ev = service.RaisedEvents[0];
        expect(ev[0]).toBe('HD44780U.DisplayControl');
        var args = ev[1];
        expect(args.displayEnabled).toBeDefined();
        expect(args.displayEnabled).toBe(false);
        expect(args.showCursor).toBeDefined();
        expect(args.showCursor).toBe(false);
        expect(args.cursorBlink).toBeDefined();
        expect(args.cursorBlink).toBe(false);
        dispControlCmd = 0x0F;
        issueCommand(dispControlCmd);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(1);
        ev = service.RaisedEvents[1];
        expect(ev[0]).toBe('HD44780U.DisplayControl');
        args = ev[1];
        expect(args.displayEnabled).toBeDefined();
        expect(args.displayEnabled).toBe(true);
        expect(args.showCursor).toBeDefined();
        expect(args.showCursor).toBe(true);
        expect(args.cursorBlink).toBeDefined();
        expect(args.cursorBlink).toBe(true);
    });
    it('Cursor or Display Shift', function () {
        issueCommand(0x01);
        tick(10);
        var ev = service.RaisedEvents[0];
        expect(ev[0]).toBe('HD44780U.ClearDisplay');
        issueCommand(0x10);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(1);
        ev = service.RaisedEvents[1];
        expect(ev[0]).toBe('HD44780U.CursorShift');
    });
    it('Set CGRAM address', function () {
        var cgAddress = 0x1B;
        issueCommand(0x40 | cgAddress);
        tick(10);
        expect(readAddressCounter()).toBe(cgAddress);
        issueCommand(0x40);
        tick(10);
        expect(readAddressCounter()).toBe(0);
    });
    it('Set DDRAM address', function () {
        var ddAddress = 0x6B;
        issueCommand(0x80 | ddAddress);
        tick(10);
        expect(readAddressCounter()).toBe(ddAddress);
        issueCommand(0x80);
        tick(10);
        expect(readAddressCounter()).toBe(0);
    });
    it('Write data to RAM', function () {
        var ddAddress = 0x33;
        var ddValue = 'A'.charCodeAt(0);
        issueCommand(0x80 | ddAddress);
        tick(10);
        expect(readAddressCounter()).toBe(ddAddress);
        issueCommand(ddValue, false, true);
        tick(10);
        expect(readAddressCounter()).toBe(ddAddress + 1);
        issueCommand(0x80 | ddAddress);
        tick(10);
        var readValue = readRam();
        expect(readValue).toBe(ddValue);
        expect(readAddressCounter()).toBe(ddAddress + 1);
    });
    var expectEvent = function (event, properties) {
        if (properties === void 0) { properties = null; }
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        var ev = service.RaisedEvents.pop();
        expect(ev[0]).toBe(event);
        if (properties != null) {
            for (var key in properties) {
                if (!properties.hasOwnProperty(key))
                    continue;
                expect(ev[1][key]).toBeDefined();
                expect(ev[1][key]).toBe(properties[key]);
            }
        }
        return ev[1];
    };
    it('Initializing by Instruction (8-Bit)', function () {
        tick(15);
        issueCommand(0x30);
        tick(4.1);
        expectEvent('HD44780U.FunctionSet');
        issueCommand(0x30);
        tick(0.1);
        expectEvent('HD44780U.FunctionSet');
        issueCommand(0x30);
        tick(0.1);
        expectEvent('HD44780U.FunctionSet');
        issueCommand(0x08);
        tick(0.1);
        expectEvent('HD44780U.DisplayControl');
        issueCommand(0x01);
        tick(0.1);
        expectEvent('HD44780U.ClearDisplay');
        issueCommand(0x07);
        tick(0.1);
        expectEvent('HD44780U.EntryModeSet');
    });
    it('Initializing by Instruction (4-Bit)', function () {
        tick(15);
        issueCommand(0x30);
        tick(4.1);
        expectEvent('HD44780U.FunctionSet');
        issueCommand(0x30);
        tick(0.1);
        expectEvent('HD44780U.FunctionSet');
        issueCommand(0x30);
        tick(0.1);
        expectEvent('HD44780U.FunctionSet');
        issueCommand(0x20);
        tick(0.1);
        expectEvent('HD44780U.FunctionSet', { nibbleMode: true });
        issueCommand(0x20);
        tick(0.1);
        issueCommand(0x00);
        tick(0.1);
        expectEvent('HD44780U.FunctionSet');
        issueCommand(0x00);
        tick(0.1);
        issueCommand(0x08 << 4);
        tick(0.1);
        expectEvent('HD44780U.DisplayControl', { displayEnabled: false });
        issueCommand(0x00);
        tick(0.1);
        issueCommand(0x01 << 4);
        tick(0.1);
        expectEvent('HD44780U.ClearDisplay');
        issueCommand(0x00);
        tick(0.1);
        issueCommand(0x07 << 4);
        tick(0.1);
        expectEvent('HD44780U.EntryModeSet');
    });
    var issueCommandAndWait = function (word, rw, rs) {
        if (rw === void 0) { rw = false; }
        if (rs === void 0) { rs = false; }
        issueCommand(word, rw, rs);
        tick(0.1);
    };
    var writeCharacter = function (character) {
        issueCommandAndWait(character.charCodeAt(0), false, true);
        var props = expectEvent('HD44780U.DataWrite');
        expect(props.ddRam).toBeDefined();
        expect(props.addressCounter).toBeDefined();
        var index = props.addressCounter - 1;
        if (props.secondDisplayLine && index >= 0x40)
            index = index - 0x18;
        expect(props.ddRam[index]).toBe(character.charCodeAt(0));
    };
    it('1-Line Display Example', function () {
        issueCommandAndWait(0x30);
        expectEvent('HD44780U.FunctionSet', { secondDisplayLine: false });
        issueCommandAndWait(0x0E);
        expectEvent('HD44780U.DisplayControl', {
            displayEnabled: true,
            showCursor: true,
            cursorBlink: false
        });
        issueCommandAndWait(0x06);
        expectEvent('HD44780U.EntryModeSet', {
            incrementAddressCounter: true,
            shiftDisplay: false
        });
        for (var _i = 0, _a = 'HITACHI'; _i < _a.length; _i++) {
            var c = _a[_i];
            writeCharacter(c);
        }
        issueCommandAndWait(0x07);
        expectEvent('HD44780U.EntryModeSet', {
            incrementAddressCounter: true,
            shiftDisplay: true
        });
        writeCharacter(' ');
        for (var _b = 0, _c = 'MICROKO'; _b < _c.length; _b++) {
            var c = _c[_b];
            writeCharacter(c);
        }
        issueCommandAndWait(0x10);
        expectEvent('HD44780U.CursorShift');
        issueCommandAndWait(0x10);
        expectEvent('HD44780U.CursorShift');
        writeCharacter('C');
        issueCommandAndWait(0x1C);
        expectEvent('HD44780U.DisplayShift');
        issueCommandAndWait(0x14);
        expectEvent('HD44780U.CursorShift');
        for (var _d = 0, _e = 'MPUTER'; _d < _e.length; _d++) {
            var c = _e[_d];
            writeCharacter(c);
        }
        issueCommandAndWait(0x02);
        expectEvent('HD44780U.ReturnHome', { addressCounter: 0 });
        for (var _f = 0, _g = 'HITACHI MICROCOMPUTER'; _f < _g.length; _f++) {
            var c = _g[_f];
            expect(readRam()).toBe(c.charCodeAt(0));
        }
    });
    it('2-Line Display Example', function () {
        issueCommandAndWait(0x38);
        expectEvent('HD44780U.FunctionSet', { secondDisplayLine: true });
        issueCommandAndWait(0x0E);
        expectEvent('HD44780U.DisplayControl', {
            displayEnabled: true,
            showCursor: true,
            cursorBlink: false
        });
        issueCommandAndWait(0x06);
        expectEvent('HD44780U.EntryModeSet', {
            incrementAddressCounter: true,
            shiftDisplay: false
        });
        for (var _i = 0, _a = 'HITACHI'; _i < _a.length; _i++) {
            var c = _a[_i];
            writeCharacter(c);
        }
        issueCommandAndWait(0xC0);
        expect(readAddressCounter()).toBe(0x40);
        issueCommandAndWait(0xC0);
        for (var _b = 0, _c = 'MICROCO'; _b < _c.length; _b++) {
            var c = _c[_b];
            writeCharacter(c);
        }
        issueCommandAndWait(0x07);
        expectEvent('HD44780U.EntryModeSet', {
            incrementAddressCounter: true,
            shiftDisplay: true
        });
        for (var _d = 0, _e = 'MPUTER'; _d < _e.length; _d++) {
            var c = _e[_d];
            writeCharacter(c);
        }
        issueCommandAndWait(0x02);
        expectEvent('HD44780U.ReturnHome', { addressCounter: 0 });
        for (var _f = 0, _g = 'HITACHI'; _f < _g.length; _f++) {
            var c = _g[_f];
            expect(readRam()).toBe(c.charCodeAt(0));
        }
        issueCommandAndWait(0xC0);
        for (var _h = 0, _j = 'MICROCOMPUTER'; _h < _j.length; _h++) {
            var c = _j[_h];
            expect(readRam()).toBe(c.charCodeAt(0));
        }
    });
});
describe('Memory Tests', function () {
    var memory;
    var service;
    beforeAll(function () {
        jasmine.clock().install();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        memory = new ARM.Simulator.Memory();
        service = new ARM.Simulator.Tests.MockService();
    });
    it('Illegal Access', function () {
        var pairs = [
            [0x12345678, ARM.Simulator.DataType.Byte],
            [0xFFFFFFFF, ARM.Simulator.DataType.Halfword],
            [0x80808080, ARM.Simulator.DataType.Word]
        ];
        for (var _i = 0, pairs_3 = pairs; _i < pairs_3.length; _i++) {
            var p = pairs_3[_i];
            expect(function () { return memory.Read(p[0], p[1]); }).toThrowError('BadAddress');
            expect(function () { return memory.Write(p[0], p[1], 0); }).toThrowError('BadAddress');
        }
    });
    it('Map and unmap regions', function () {
        var region = new ARM.Simulator.Region(0x80000000, 0x10000);
        expect(memory.Map(region)).toBe(true);
        expect(memory.Map(region)).toBe(false);
        var tuples = [
            [0x80000000, 0x12345678, ARM.Simulator.DataType.Word],
            [0x8000ABCD, 0xACED, ARM.Simulator.DataType.Halfword],
            [0x8000FFFF, 0x98, ARM.Simulator.DataType.Byte]
        ];
        for (var _i = 0, tuples_1 = tuples; _i < tuples_1.length; _i++) {
            var t = tuples_1[_i];
            memory.Write(t[0], t[2], t[1]);
            var readValue = memory.Read(t[0], t[2]);
            expect(readValue).toBe(t[1]);
        }
        expect(memory.Unmap(region)).toBe(true);
        expect(memory.Unmap(region)).toBe(false);
        var _loop_2 = function(t) {
            expect(function () { return memory.Write(t[0], t[2], t[1]); }).toThrowError('BadAddress');
            expect(function () { return memory.Read(t[0], t[2]); }).toThrowError('BadAddress');
        };
        for (var _a = 0, tuples_2 = tuples; _a < tuples_2.length; _a++) {
            var t = tuples_2[_a];
            _loop_2(t);
        }
    });
    it('Overlapping regions', function () {
        var a = new ARM.Simulator.Region(0x00000000, 0x00001000);
        var b = new ARM.Simulator.Region(0x00000100, 0x00000100);
        expect(memory.Map(a)).toBe(true);
        expect(memory.Map(b)).toBe(false);
        expect(memory.Unmap(a)).toBe(true);
        expect(memory.Map(b)).toBe(true);
        expect(memory.Map(a)).toBe(false);
        expect(memory.Unmap(b)).toBe(true);
    });
    it('Data Types', function () {
        var region = new ARM.Simulator.Region(0x00000000, 0x00001000);
        expect(memory.Map(region)).toBe(true);
        var word = 0x12345678;
        memory.Write(0, ARM.Simulator.DataType.Word, word);
        var read = memory.Read(0, ARM.Simulator.DataType.Word);
        expect(read).toBe(word);
        read = memory.Read(0, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x5678);
        read = memory.Read(2, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x1234);
        for (var i = 0; i < 4; i++) {
            read = memory.Read(i, ARM.Simulator.DataType.Byte);
            expect(read).toBe((word >>> (i * 8)) & 0xFF);
        }
        read = memory.Read(2, ARM.Simulator.DataType.Word);
        expect(read).toBe(word);
        read = memory.Read(1, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x5678);
        read = memory.Read(3, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x1234);
        var bytes = [0x78, 0x56, 0x34, 0x12];
        var address = 0x0ABC;
        for (var i = 0; i < bytes.length; i++)
            memory.Write(address + i, ARM.Simulator.DataType.Byte, bytes[i]);
        read = memory.Read(address, ARM.Simulator.DataType.Word);
        expect(read).toBe(word);
    });
    it('Memory-mapped registers', function () {
        var readCalled = false;
        var writeCalled = false;
        var region = new ARM.Simulator.Region(0x00400000, 0x00010000, function (a, t) {
            expect(a).toBe(0x8000);
            expect(t).toBe(ARM.Simulator.DataType.Byte);
            readCalled = true;
            return 0x42;
        }, function (a, t, v) {
            expect(a).toBe(0x1234);
            expect(t).toBe(ARM.Simulator.DataType.Word);
            expect(v).toBe(0x12345678);
            writeCalled = true;
        });
        expect(memory.Map(region)).toBe(true);
        memory.Write(0x00401234, ARM.Simulator.DataType.Word, 0x12345678);
        expect(writeCalled).toBe(true);
        var value = memory.Read(0x00408000, ARM.Simulator.DataType.Byte);
        expect(readCalled).toBe(true);
        expect(value).toBe(0x42);
    });
});
describe('PIC Tests', function () {
    var pic;
    var service;
    var irq = null;
    var fiq = null;
    var clockRate = 58.9824;
    beforeAll(function () {
        jasmine.clock().install();
        jasmine.clock().mockDate();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        pic = new ARM.Simulator.Devices.PIC(0, function (active) {
            if (irq != null)
                irq(active);
        }, function (active) {
            if (fiq != null)
                fiq(active);
        });
        service = new ARM.Simulator.Tests.MockService(clockRate);
        expect(pic.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        irq = null;
        fiq = null;
        pic.OnUnregister();
    });
    var tick = function (ms) {
        service.Tick(ms);
        jasmine.clock().tick(ms);
    };
    it('Reset Values', function () {
        var registers = [
            [0x00, 0x00000000],
            [0x04, 0x00000000],
            [0x08, 0x003FFFFF],
            [0x0C, 0x03020100],
            [0x10, 0x07060504],
            [0x14, 0x0B0A0908],
            [0x18, 0x0F0E0D0C],
            [0x1C, 0x13121110],
            [0x20, 0x00000014],
            [0x24, 0x00000054],
            [0x28, 0x00000000],
            [0x30, 0x00000054],
            [0x34, 0x00000054],
        ];
        for (var _i = 0, registers_1 = registers; _i < registers_1.length; _i++) {
            var entry = registers_1[_i];
            var value = pic.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });
    it('Global Interrupt Disable', function () {
        var irqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.SetSignal(4, true);
        expect(irqstack.pop()).toBe(true);
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 4);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 4);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(0);
        pic.SetSignal(4, false);
        expect(irqstack.pop()).toBe(false);
        pic.Write(8, ARM.Simulator.DataType.Word, (1 << 21));
        pic.SetSignal(12, true);
        expect(irqstack.length).toBe(0);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 12);
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        expect(irqstack.pop()).toBe(true);
    });
    it('Fast Interrupt Request (FIQ)', function () {
        var irqstack = new Array(), fiqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        fiq = function (a) { return fiqstack.push(a); };
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.SetSignal(0, true);
        expect(irqstack.pop()).toBe(true);
        expect(fiqstack.length).toBe(0);
        pic.Write(4, ARM.Simulator.DataType.Word, 1);
        expect(irqstack.pop()).toBe(false);
        expect(fiqstack.length).toBe(0);
        pic.Write(0, ARM.Simulator.DataType.Word, 1);
        pic.SetSignal(0, true);
        expect(irqstack.length).toBe(0);
        expect(fiqstack.pop()).toBe(true);
        pic.Write(4, ARM.Simulator.DataType.Word, 1);
        expect(irqstack.length).toBe(0);
        expect(fiqstack.pop()).toBe(false);
    });
    it('Multiple Interrupts', function () {
        var irqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.SetSignal(20, true);
        expect(irqstack.pop()).toBe(true);
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 20);
        pic.SetSignal(15, true);
        expect(irqstack.length).toBe(0);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 20) | (1 << 15));
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 20);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 15);
        expect(irqstack.length).toBe(0);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 15);
        expect(irqstack.pop()).toBe(false);
    });
    it('Mask Interrupt Source', function () {
        var irqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.SetSignal(13, true);
        expect(irqstack.pop()).toBe(true);
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 13);
        pic.Write(4, ARM.Simulator.DataType.Word, pending);
        expect(irqstack.pop()).toBe(false);
        pic.SetSignal(13, false);
        pic.Write(8, ARM.Simulator.DataType.Word, 1 << 13);
        pic.SetSignal(13, true);
        expect(irqstack.length).toBe(0);
        pic.SetSignal(14, true);
        expect(irqstack.pop()).toBe(true);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 14);
        pic.SetSignal(14, false);
        expect(irqstack.pop()).toBe(false);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 13);
        var mask = pic.Read(8, ARM.Simulator.DataType.Word);
        pic.Write(8, ARM.Simulator.DataType.Word, mask & ~(1 << 13));
        expect(irqstack.pop()).toBe(true);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 13);
        expect(irqstack.pop()).toBe(false);
        pic.SetSignal(13, false);
    });
    it('Interrupt Priorities #1', function () {
        var base = 0x0C;
        var priorities = [
            0x00000014, 0x13121110, 0x0F0E0D0C, 0x0B0A0908, 0x07060504, 0x03020100
        ];
        for (var i = 0; i < priorities.length; i++) {
            expect(pic.Read(base + (priorities.length - 1 - i) * 4, ARM.Simulator.DataType.Word)).toBe(priorities[i]);
        }
        for (var i = 0; i < priorities.length; i++)
            pic.Write(base + i * 4, ARM.Simulator.DataType.Word, priorities[i]);
        for (var i = 0; i < priorities.length; i++)
            expect(pic.Read(base + i * 4, ARM.Simulator.DataType.Word)).toBe(priorities[i]);
    });
    it('Interrupt Priorities #2', function () {
        var irqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        var base = 0x0C;
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.Write(base + 0x14, ARM.Simulator.DataType.Word, 0x00000004);
        pic.Write(base + 0x08, ARM.Simulator.DataType.Word, 0x000C0000);
        pic.Write(base + 0x00, ARM.Simulator.DataType.Word, 0x00000014);
        pic.SetSignal(12, true);
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 12);
        var intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(12 << 2);
        var pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe(1 << 10);
        pic.SetSignal(4, true);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 12) | (1 << 4));
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(4 << 2);
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe((1 << 10) | (1 << 20));
        pic.SetSignal(20, true);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 12) | (1 << 4) | (1 << 20));
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(4 << 2);
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe((1 << 10) | (1 << 20) | (1 << 0));
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 4);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(12 << 2);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 12);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(20 << 2);
        expect(irqstack.length).toBe(1);
        expect(irqstack.pop()).toBe(true);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 20);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(0x54);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(0);
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe(0);
        expect(irqstack.pop()).toBe(false);
    });
    it('Highest Priority IRQ/FIQ Interrupt', function () {
        var irqstack = new Array();
        var fiqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        fiq = function (a) { return fiqstack.push(a); };
        var base = 0x0C;
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.Write(base + 0x10, ARM.Simulator.DataType.Word, 0x000E0000);
        pic.Write(base + 0x0C, ARM.Simulator.DataType.Word, 0x01000000);
        pic.Write(base + 0x04, ARM.Simulator.DataType.Word, 0x00000007);
        pic.Write(0, ARM.Simulator.DataType.Word, (1 << 14) | (1 << 7));
        pic.SetSignal(7, true);
        expect(fiqstack.pop()).toBe(true);
        var intoset_irq = pic.Read(0x34, ARM.Simulator.DataType.Word);
        expect(intoset_irq).toBe(0x54);
        var intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(7 << 2);
        var intoset_fiq = pic.Read(0x30, ARM.Simulator.DataType.Word);
        expect(intoset_fiq).toBe(7 << 2);
        pic.SetSignal(1, true);
        expect(irqstack.pop()).toBe(true);
        intoset_irq = pic.Read(0x34, ARM.Simulator.DataType.Word);
        expect(intoset_irq).toBe(1 << 2);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(1 << 2);
        pic.SetSignal(14, true);
        intoset_fiq = pic.Read(0x30, ARM.Simulator.DataType.Word);
        expect(intoset_fiq).toBe(14 << 2);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 1);
        intoset_irq = pic.Read(0x34, ARM.Simulator.DataType.Word);
        expect(intoset_irq).toBe(0x54);
        expect(irqstack.pop()).toBe(false);
        expect(fiqstack.length).toBe(0);
        pic.Write(4, ARM.Simulator.DataType.Word, (1 << 7) | (1 << 14));
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(0x54);
        intoset_fiq = pic.Read(0x30, ARM.Simulator.DataType.Word);
        expect(intoset_fiq).toBe(0x54);
        expect(fiqstack.pop()).toBe(false);
    });
    it('Pending Test Register', function () {
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(0);
        var pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe(0);
        var base = 0x0C;
        pic.Write(base + 0x10, ARM.Simulator.DataType.Word, 0x04001400);
        pic.Write(base + 0x04, ARM.Simulator.DataType.Word, 0x000D0000);
        pic.Write(base + 0x00, ARM.Simulator.DataType.Word, 0x00000E00);
        pic.Write(0x2C, ARM.Simulator.DataType.Word, (1 << 4) | (1 << 13) | (1 << 14) | (1 << 20));
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 4) | (1 << 13) | (1 << 14) | (1 << 20));
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe((1 << 19) | (1 << 6) | (1 << 1) | (1 << 17));
    });
});
describe('Timer Tests', function () {
    var timer;
    var service;
    var interrupt = null;
    var clockRate = 58.9824;
    beforeAll(function () {
        jasmine.clock().install();
        jasmine.clock().mockDate();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        timer = new ARM.Simulator.Devices.Timer(0, function (active) {
            if (interrupt != null && active)
                interrupt(active);
        });
        service = new ARM.Simulator.Tests.MockService(clockRate);
        expect(timer.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        interrupt = null;
        timer.OnUnregister();
    });
    var tick = function (ms) {
        service.Tick(ms);
        jasmine.clock().tick(ms);
    };
    it('Reset Values', function () {
        var registers = [
            [0x00, 0x00],
            [0x04, 0x00],
            [0x08, 0x00]
        ];
        for (var _i = 0, registers_2 = registers; _i < registers_2.length; _i++) {
            var entry = registers_2[_i];
            var value = timer.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });
    it('Overflow Interrupt', function () {
        var numOverflow = 0;
        interrupt = function () {
            var mode = timer.Read(0, ARM.Simulator.DataType.Word);
            expect(mode & 0xC00).toBe(0x800);
            timer.Write(0, ARM.Simulator.DataType.Word, mode & ~0x800);
            numOverflow++;
        };
        timer.Write(0, ARM.Simulator.DataType.Word, 0x280);
        tick(1000);
        expect(numOverflow).toBe(900);
    });
    it('Compare Interrupt', function () {
        var numInterrupts = 0;
        interrupt = function () {
            var mode = timer.Read(0, ARM.Simulator.DataType.Word);
            expect(mode & 0xC00).toBe(0x400);
            timer.Write(0, ARM.Simulator.DataType.Word, mode & ~0x400);
            numInterrupts++;
        };
        var countUpTo = (1 << 12);
        timer.Write(8, ARM.Simulator.DataType.Word, countUpTo);
        timer.Write(0, ARM.Simulator.DataType.Word, 0x1C2);
        tick(1000);
        expect(numInterrupts).toBe(56);
    });
    it('Stop and Continue', function () {
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBe(0);
        timer.Write(0, ARM.Simulator.DataType.Word, 0x82);
        tick(1);
        var count = timer.Read(4, ARM.Simulator.DataType.Word);
        expect(count).toBe(230);
        var mode = timer.Read(0, ARM.Simulator.DataType.Word);
        timer.Write(0, ARM.Simulator.DataType.Word, mode & ~(1 << 7));
        tick(100);
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBe(count);
        timer.Write(0, ARM.Simulator.DataType.Word, mode);
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBe(count);
        tick(1);
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBeGreaterThan(count);
    });
});
describe('TL16C750 Tests', function () {
    var uart;
    var service;
    var interrupt = null;
    beforeAll(function () {
        jasmine.clock().install();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        uart = new ARM.Simulator.Devices.TL16C750(0, function (active) {
            if (interrupt != null)
                interrupt(active);
        });
        service = new ARM.Simulator.Tests.MockService();
        expect(uart.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        interrupt = null;
        uart.OnUnregister();
    });
    it('Function Reset', function () {
        var registers = [
            [0x04, 0x00],
            [0x08, 0x01],
            [0x0C, 0x00],
            [0x10, 0x00],
            [0x14, 0x60]
        ];
        for (var _i = 0, registers_3 = registers; _i < registers_3.length; _i++) {
            var entry = registers_3[_i];
            var value = uart.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });
    it('Serial IO #1', function () {
        var values = [
            [0x04, 0x00],
            [0x0C, 0x80],
            [0x00, 0x03],
            [0x04, 0x00],
            [0x0C, 0x03],
            [0x08, 0xC7],
            [0x10, 0x0B]
        ];
        for (var _i = 0, values_4 = values; _i < values_4.length; _i++) {
            var pair = values_4[_i];
            uart.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
        }
        var chars = ['H', 'e', 'l', 'l', 'o', ' ', 'W', 'o', 'r', 'l', 'd'];
        for (var _a = 0, chars_1 = chars; _a < chars_1.length; _a++) {
            var c = chars_1[_a];
            uart.Write(0, ARM.Simulator.DataType.Word, c.charCodeAt(0));
            jasmine.clock().tick(20);
        }
        expect(service.RaisedEvents.length).toBe(chars.length);
        for (var i = 0; i < service.RaisedEvents.length; i++) {
            expect(service.RaisedEvents[i][0]).toBe('TL16C750.Data');
            expect(service.RaisedEvents[i][1]).toBe(chars[i].charCodeAt(0));
        }
    });
    it('Serial IO #2', function () {
        var actualString = '';
        interrupt = function () {
            var iir = uart.Read(0x08, ARM.Simulator.DataType.Word);
            while ((iir & 0x01) === 0) {
                var character = uart.Read(0, ARM.Simulator.DataType.Word);
                actualString = actualString.concat(String.fromCharCode(character));
                iir = uart.Read(0x08, ARM.Simulator.DataType.Word);
            }
        };
        var values = [
            [0x0C, 0x80],
            [0x00, 0x01],
            [0x04, 0x00],
            [0x0C, 0x03],
            [0x04, 0x00],
            [0x04, 0x01]
        ];
        for (var _i = 0, values_5 = values; _i < values_5.length; _i++) {
            var pair = values_5[_i];
            uart.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
            jasmine.clock().tick(10);
        }
        var message = 'Hello from tty! This is just a test.';
        for (var _a = 0, message_1 = message; _a < message_1.length; _a++) {
            var char = message_1[_a];
            uart.SerialInput(char.charCodeAt(0));
            jasmine.clock().tick(20);
        }
        expect(actualString).toMatch(message);
    });
    it('Serial IO #3', function () {
        var fifoTriggerLevel = 16;
        var actualData = [];
        interrupt = function (active) {
            if (active === false)
                return;
            var iir = uart.Read(0x08, ARM.Simulator.DataType.Word);
            while ((iir & 0x01) === 0) {
                if ((iir & 0x0C) === 0x0C) {
                    var character = uart.Read(0, ARM.Simulator.DataType.Word);
                    actualData.push(String.fromCharCode(character));
                }
                else if ((iir & 0x04) === 0x04) {
                    for (var i = 0; i < fifoTriggerLevel; i++) {
                        var character = uart.Read(0, ARM.Simulator.DataType.Word);
                        actualData.push(String.fromCharCode(character));
                    }
                }
                iir = uart.Read(0x08, ARM.Simulator.DataType.Word);
            }
        };
        var values = [
            [0x0C, 0x80],
            [0x00, 0x01],
            [0x04, 0x00],
            [0x0C, 0x83],
            [0x04, 0x00],
            [0x08, 0x67],
            [0x0C, 0x03],
            [0x04, 0x01]
        ];
        for (var _i = 0, values_6 = values; _i < values_6.length; _i++) {
            var pair = values_6[_i];
            uart.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
            jasmine.clock().tick(10);
        }
        var message = 'Hello from test tty!';
        expect(message.length).toBeGreaterThan(15);
        for (var _a = 0, message_2 = message; _a < message_2.length; _a++) {
            var char = message_2[_a];
            uart.SerialInput(char.charCodeAt(0));
            jasmine.clock().tick(20);
        }
        expect(actualData.length).toBe(message.length);
        for (var i = 0; i < actualData.length; i++)
            expect(actualData[i]).toBe(message[i]);
    });
});
describe('Virtual Machine Integration Tests', function () {
    var vm;
    var elf;
    var uart0;
    var output = '';
    var bootImage = [
        0x7F, 0x45, 0x4C, 0x46, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x28, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x34, 0x00,
        0x00, 0x00, 0x5C, 0x08, 0x00, 0x00, 0x00, 0x02, 0x00, 0x05,
        0x34, 0x00, 0x20, 0x00, 0x02, 0x00, 0x28, 0x00, 0x09, 0x00,
        0x06, 0x00, 0x01, 0x00, 0x00, 0x00, 0x74, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x78, 0x02,
        0x00, 0x00, 0x78, 0x02, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0xEC, 0x02,
        0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x04, 0x00,
        0x07, 0x00, 0x00, 0x00, 0x08, 0x01, 0x00, 0x00, 0x06, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x0C, 0x00, 0x00, 0xEA,
        0x05, 0x00, 0x00, 0xEA, 0x05, 0x00, 0x00, 0xEA, 0x05, 0x00,
        0x00, 0xEA, 0x05, 0x00, 0x00, 0xEA, 0x00, 0x00, 0xA0, 0xE1,
        0x04, 0x00, 0x00, 0xEA, 0x04, 0x00, 0x00, 0xEA, 0xFE, 0xFF,
        0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA,
        0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF,
        0xFF, 0xEA, 0x00, 0x00, 0xA0, 0xE3, 0x28, 0x10, 0x9F, 0xE5,
        0x28, 0x20, 0x9F, 0xE5, 0x02, 0x00, 0x51, 0xE1, 0x01, 0x00,
        0x00, 0x0A, 0x01, 0x00, 0xC1, 0xE4, 0xFB, 0xFF, 0xFF, 0xEA,
        0x12, 0x09, 0xA0, 0xE3, 0x00, 0xD0, 0xA0, 0xE1, 0x76, 0x00,
        0x00, 0xEB, 0x0C, 0x00, 0x9F, 0xE5, 0x01, 0x10, 0xA0, 0xE3,
        0x00, 0x10, 0xC0, 0xE5, 0x07, 0x00, 0x04, 0x00, 0x08, 0x01,
        0x04, 0x00, 0x00, 0xC0, 0x1F, 0xE0, 0x04, 0xB0, 0x2D, 0xE5,
        0x00, 0xB0, 0x8D, 0xE2, 0x4E, 0x32, 0xA0, 0xE3, 0x00, 0x20,
        0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5, 0xCE, 0x32, 0xA0, 0xE3,
        0x80, 0x20, 0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5, 0x0E, 0x32,
        0xA0, 0xE3, 0x03, 0x20, 0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5,
        0x4E, 0x32, 0xA0, 0xE3, 0x00, 0x20, 0xA0, 0xE3, 0x00, 0x20,
        0x83, 0xE5, 0xCE, 0x32, 0xA0, 0xE3, 0x03, 0x20, 0xA0, 0xE3,
        0x00, 0x20, 0x83, 0xE5, 0x8E, 0x32, 0xA0, 0xE3, 0xC7, 0x20,
        0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5, 0x00, 0x00, 0xA0, 0xE1,
        0x00, 0xD0, 0x4B, 0xE2, 0x04, 0xB0, 0x9D, 0xE4, 0x1E, 0xFF,
        0x2F, 0xE1, 0x04, 0xB0, 0x2D, 0xE5, 0x00, 0xB0, 0x8D, 0xE2,
        0x0C, 0xD0, 0x4D, 0xE2, 0x00, 0x30, 0xA0, 0xE1, 0x05, 0x30,
        0x4B, 0xE5, 0x00, 0x00, 0xA0, 0xE1, 0x28, 0x30, 0x9F, 0xE5,
        0x00, 0x30, 0x93, 0xE5, 0x20, 0x30, 0x03, 0xE2, 0x00, 0x00,
        0x53, 0xE3, 0xFA, 0xFF, 0xFF, 0x0A, 0x0E, 0x22, 0xA0, 0xE3,
        0x05, 0x30, 0x5B, 0xE5, 0x00, 0x30, 0x82, 0xE5, 0x00, 0x00,
        0xA0, 0xE1, 0x00, 0xD0, 0x4B, 0xE2, 0x04, 0xB0, 0x9D, 0xE4,
        0x1E, 0xFF, 0x2F, 0xE1, 0x14, 0x00, 0x00, 0xE0, 0x00, 0x48,
        0x2D, 0xE9, 0x04, 0xB0, 0x8D, 0xE2, 0x08, 0xD0, 0x4D, 0xE2,
        0x08, 0x00, 0x0B, 0xE5, 0x06, 0x00, 0x00, 0xEA, 0x08, 0x30,
        0x1B, 0xE5, 0x00, 0x30, 0xD3, 0xE5, 0x03, 0x00, 0xA0, 0xE1,
        0xE3, 0xFF, 0xFF, 0xEB, 0x08, 0x30, 0x1B, 0xE5, 0x01, 0x30,
        0x83, 0xE2, 0x08, 0x30, 0x0B, 0xE5, 0x08, 0x30, 0x1B, 0xE5,
        0x00, 0x30, 0xD3, 0xE5, 0x00, 0x00, 0x53, 0xE3, 0xF4, 0xFF,
        0xFF, 0x1A, 0x00, 0x00, 0xA0, 0xE1, 0x04, 0xD0, 0x4B, 0xE2,
        0x00, 0x48, 0xBD, 0xE8, 0x1E, 0xFF, 0x2F, 0xE1, 0x04, 0xB0,
        0x2D, 0xE5, 0x00, 0xB0, 0x8D, 0xE2, 0x00, 0x00, 0xA0, 0xE1,
        0x28, 0x30, 0x9F, 0xE5, 0x00, 0x30, 0x93, 0xE5, 0x01, 0x30,
        0x03, 0xE2, 0x00, 0x00, 0x53, 0xE3, 0xFA, 0xFF, 0xFF, 0x0A,
        0x0E, 0x32, 0xA0, 0xE3, 0x00, 0x30, 0x93, 0xE5, 0xFF, 0x30,
        0x03, 0xE2, 0x03, 0x00, 0xA0, 0xE1, 0x00, 0xD0, 0x4B, 0xE2,
        0x04, 0xB0, 0x9D, 0xE4, 0x1E, 0xFF, 0x2F, 0xE1, 0x14, 0x00,
        0x00, 0xE0, 0x00, 0x48, 0x2D, 0xE9, 0x04, 0xB0, 0x8D, 0xE2,
        0x08, 0xD0, 0x4D, 0xE2, 0x00, 0x30, 0xA0, 0xE3, 0x08, 0x30,
        0x0B, 0xE5, 0x08, 0x00, 0x00, 0xEA, 0x08, 0x30, 0x1B, 0xE5,
        0x01, 0x20, 0x83, 0xE2, 0x08, 0x20, 0x0B, 0xE5, 0x58, 0x10,
        0x9F, 0xE5, 0x09, 0x20, 0x5B, 0xE5, 0x03, 0x20, 0xC1, 0xE7,
        0x09, 0x30, 0x5B, 0xE5, 0x0A, 0x00, 0x53, 0xE3, 0x06, 0x00,
        0x00, 0x0A, 0xDF, 0xFF, 0xFF, 0xEB, 0x00, 0x30, 0xA0, 0xE1,
        0x09, 0x30, 0x4B, 0xE5, 0x09, 0x30, 0x5B, 0xE5, 0x00, 0x00,
        0x53, 0xE3, 0xF0, 0xFF, 0xFF, 0x1A, 0x00, 0x00, 0x00, 0xEA,
        0x00, 0x00, 0xA0, 0xE1, 0x20, 0x20, 0x9F, 0xE5, 0x08, 0x30,
        0x1B, 0xE5, 0x03, 0x30, 0x82, 0xE0, 0x00, 0x20, 0xA0, 0xE3,
        0x00, 0x20, 0xC3, 0xE5, 0x0C, 0x30, 0x9F, 0xE5, 0x03, 0x00,
        0xA0, 0xE1, 0x04, 0xD0, 0x4B, 0xE2, 0x00, 0x48, 0xBD, 0xE8,
        0x1E, 0xFF, 0x2F, 0xE1, 0x08, 0x00, 0x04, 0x00, 0x00, 0x48,
        0x2D, 0xE9, 0x04, 0xB0, 0x8D, 0xE2, 0x8B, 0xFF, 0xFF, 0xEB,
        0x24, 0x00, 0x9F, 0xE5, 0xB4, 0xFF, 0xFF, 0xEB, 0xD7, 0xFF,
        0xFF, 0xEB, 0x00, 0x30, 0xA0, 0xE1, 0x03, 0x00, 0xA0, 0xE1,
        0xB0, 0xFF, 0xFF, 0xEB, 0x00, 0x30, 0xA0, 0xE3, 0x03, 0x00,
        0xA0, 0xE1, 0x04, 0xD0, 0x4B, 0xE2, 0x00, 0x48, 0xBD, 0xE8,
        0x1E, 0xFF, 0x2F, 0xE1, 0x00, 0x00, 0x04, 0x00, 0x65, 0x63,
        0x68, 0x6F, 0x3A, 0x20, 0x00, 0x41, 0x2B, 0x00, 0x00, 0x00,
        0x61, 0x65, 0x61, 0x62, 0x69, 0x00, 0x01, 0x21, 0x00, 0x00,
        0x00, 0x05, 0x41, 0x52, 0x4D, 0x37, 0x54, 0x44, 0x4D, 0x49,
        0x00, 0x06, 0x02, 0x08, 0x01, 0x09, 0x01, 0x12, 0x04, 0x14,
        0x01, 0x15, 0x01, 0x17, 0x03, 0x18, 0x01, 0x1A, 0x01, 0x47,
        0x43, 0x43, 0x3A, 0x20, 0x28, 0x47, 0x4E, 0x55, 0x20, 0x54,
        0x6F, 0x6F, 0x6C, 0x73, 0x20, 0x66, 0x6F, 0x72, 0x20, 0x41,
        0x52, 0x4D, 0x20, 0x45, 0x6D, 0x62, 0x65, 0x64, 0x64, 0x65,
        0x64, 0x20, 0x50, 0x72, 0x6F, 0x63, 0x65, 0x73, 0x73, 0x6F,
        0x72, 0x73, 0x29, 0x20, 0x35, 0x2E, 0x33, 0x2E, 0x31, 0x20,
        0x32, 0x30, 0x31, 0x36, 0x30, 0x33, 0x30, 0x37, 0x20, 0x28,
        0x72, 0x65, 0x6C, 0x65, 0x61, 0x73, 0x65, 0x29, 0x20, 0x5B,
        0x41, 0x52, 0x4D, 0x2F, 0x65, 0x6D, 0x62, 0x65, 0x64, 0x64,
        0x65, 0x64, 0x2D, 0x35, 0x2D, 0x62, 0x72, 0x61, 0x6E, 0x63,
        0x68, 0x20, 0x72, 0x65, 0x76, 0x69, 0x73, 0x69, 0x6F, 0x6E,
        0x20, 0x32, 0x33, 0x34, 0x35, 0x38, 0x39, 0x5D, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x02, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x04, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x05, 0x00, 0x01, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0xF1, 0xFF, 0x0B, 0x00, 0x00, 0x00, 0x38, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x1A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x1D, 0x00, 0x00, 0x00,
        0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x30, 0x00, 0x00, 0x00, 0x24, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x42, 0x00,
        0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x54, 0x00, 0x00, 0x00, 0x2C, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x62, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x6F, 0x00, 0x00, 0x00,
        0x34, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x7C, 0x00, 0x00, 0x00, 0x38, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x84, 0x00,
        0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x87, 0x00, 0x00, 0x00, 0x54, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x8A, 0x00, 0x00, 0x00, 0x00, 0xC0, 0x1F, 0xE0, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0xF1, 0xFF, 0x9C, 0x00, 0x00, 0x00,
        0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xF1, 0xFF, 0xA5, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF1, 0xFF, 0xAE, 0x00,
        0x00, 0x00, 0x00, 0x80, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0xF1, 0xFF, 0xB7, 0x00, 0x00, 0x00, 0x60, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0xBD, 0x00, 0x00, 0x00, 0x6C, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xC0, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00,
        0xF1, 0xFF, 0x1A, 0x00, 0x00, 0x00, 0x78, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xBD, 0x00,
        0x00, 0x00, 0x20, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x1A, 0x00, 0x00, 0x00, 0x24, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0xBD, 0x00, 0x00, 0x00, 0xB0, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x1A, 0x00, 0x00, 0x00,
        0xB4, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0xBD, 0x00, 0x00, 0x00, 0x38, 0x02, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xCE, 0x00,
        0x00, 0x00, 0x08, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x03, 0x00, 0xBD, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00,
        0x1A, 0x00, 0x00, 0x00, 0x3C, 0x02, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xBD, 0x00, 0x00, 0x00,
        0x74, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0xBD, 0x00, 0x00, 0x00, 0x08, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0xD7, 0x00,
        0x00, 0x00, 0xD8, 0x00, 0x00, 0x00, 0x4C, 0x00, 0x00, 0x00,
        0x12, 0x00, 0x01, 0x00, 0x0A, 0x01, 0x00, 0x00, 0x08, 0x01,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x03, 0x00,
        0xE0, 0x00, 0x00, 0x00, 0x74, 0x01, 0x00, 0x00, 0x40, 0x00,
        0x00, 0x00, 0x12, 0x00, 0x01, 0x00, 0xE9, 0x00, 0x00, 0x00,
        0x07, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0x02, 0x00, 0xF7, 0x00, 0x00, 0x00, 0x78, 0x00, 0x00, 0x00,
        0x60, 0x00, 0x00, 0x00, 0x12, 0x00, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x10, 0x00, 0x01, 0x00, 0x09, 0x01, 0x00, 0x00, 0x08, 0x01,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x03, 0x00,
        0x15, 0x01, 0x00, 0x00, 0x08, 0x01, 0x04, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x10, 0x00, 0x03, 0x00, 0x1B, 0x01, 0x00, 0x00,
        0xB4, 0x01, 0x00, 0x00, 0x88, 0x00, 0x00, 0x00, 0x12, 0x00,
        0x01, 0x00, 0x24, 0x01, 0x00, 0x00, 0x07, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x02, 0x00, 0x30, 0x01,
        0x00, 0x00, 0x3C, 0x02, 0x00, 0x00, 0x3C, 0x00, 0x00, 0x00,
        0x12, 0x00, 0x01, 0x00, 0x35, 0x01, 0x00, 0x00, 0x24, 0x01,
        0x00, 0x00, 0x50, 0x00, 0x00, 0x00, 0x12, 0x00, 0x01, 0x00,
        0x3E, 0x01, 0x00, 0x00, 0x07, 0x00, 0x04, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x10, 0x00, 0x02, 0x00, 0x16, 0x01, 0x00, 0x00,
        0x08, 0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0x03, 0x00, 0x45, 0x01, 0x00, 0x00, 0x07, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x02, 0x00, 0x00, 0x73,
        0x74, 0x61, 0x72, 0x74, 0x75, 0x70, 0x2E, 0x6F, 0x00, 0x52,
        0x65, 0x73, 0x65, 0x74, 0x45, 0x78, 0x63, 0x65, 0x70, 0x74,
        0x69, 0x6F, 0x6E, 0x00, 0x24, 0x61, 0x00, 0x55, 0x6E, 0x64,
        0x65, 0x66, 0x69, 0x6E, 0x65, 0x64, 0x45, 0x78, 0x63, 0x65,
        0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00, 0x53, 0x6F, 0x66, 0x74,
        0x77, 0x61, 0x72, 0x65, 0x45, 0x78, 0x63, 0x65, 0x70, 0x74,
        0x69, 0x6F, 0x6E, 0x00, 0x50, 0x72, 0x65, 0x66, 0x65, 0x74,
        0x63, 0x68, 0x45, 0x78, 0x63, 0x65, 0x70, 0x74, 0x69, 0x6F,
        0x6E, 0x00, 0x44, 0x61, 0x74, 0x61, 0x45, 0x78, 0x63, 0x65,
        0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00, 0x49, 0x52, 0x51, 0x45,
        0x78, 0x63, 0x65, 0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00, 0x46,
        0x49, 0x51, 0x45, 0x78, 0x63, 0x65, 0x70, 0x74, 0x69, 0x6F,
        0x6E, 0x00, 0x7A, 0x65, 0x72, 0x6F, 0x62, 0x73, 0x73, 0x00,
        0x6C, 0x31, 0x00, 0x6C, 0x32, 0x00, 0x50, 0x4F, 0x57, 0x45,
        0x52, 0x5F, 0x43, 0x4F, 0x4E, 0x54, 0x52, 0x4F, 0x4C, 0x5F,
        0x52, 0x45, 0x47, 0x00, 0x52, 0x41, 0x4D, 0x5F, 0x53, 0x69,
        0x7A, 0x65, 0x00, 0x52, 0x41, 0x4D, 0x5F, 0x42, 0x61, 0x73,
        0x65, 0x00, 0x54, 0x6F, 0x70, 0x53, 0x74, 0x61, 0x63, 0x6B,
        0x00, 0x5F, 0x65, 0x78, 0x69, 0x74, 0x00, 0x24, 0x64, 0x00,
        0x69, 0x6E, 0x74, 0x65, 0x67, 0x72, 0x61, 0x74, 0x69, 0x6F,
        0x6E, 0x2E, 0x63, 0x00, 0x62, 0x75, 0x66, 0x2E, 0x34, 0x31,
        0x38, 0x34, 0x00, 0x73, 0x69, 0x6F, 0x5F, 0x70, 0x75, 0x74,
        0x63, 0x00, 0x73, 0x69, 0x6F, 0x5F, 0x67, 0x65, 0x74, 0x63,
        0x00, 0x5F, 0x5F, 0x62, 0x73, 0x73, 0x5F, 0x73, 0x74, 0x61,
        0x72, 0x74, 0x5F, 0x5F, 0x00, 0x73, 0x69, 0x6F, 0x5F, 0x69,
        0x6E, 0x69, 0x74, 0x00, 0x5F, 0x73, 0x74, 0x61, 0x72, 0x74,
        0x75, 0x70, 0x00, 0x5F, 0x5F, 0x62, 0x73, 0x73, 0x5F, 0x65,
        0x6E, 0x64, 0x5F, 0x5F, 0x00, 0x5F, 0x5F, 0x65, 0x6E, 0x64,
        0x00, 0x73, 0x69, 0x6F, 0x5F, 0x67, 0x65, 0x74, 0x73, 0x00,
        0x5F, 0x5F, 0x62, 0x73, 0x73, 0x5F, 0x73, 0x74, 0x61, 0x72,
        0x74, 0x00, 0x6D, 0x61, 0x69, 0x6E, 0x00, 0x73, 0x69, 0x6F,
        0x5F, 0x70, 0x75, 0x74, 0x73, 0x00, 0x5F, 0x65, 0x64, 0x61,
        0x74, 0x61, 0x00, 0x5F, 0x5F, 0x64, 0x61, 0x74, 0x61, 0x5F,
        0x73, 0x74, 0x61, 0x72, 0x74, 0x00, 0x00, 0x2E, 0x73, 0x79,
        0x6D, 0x74, 0x61, 0x62, 0x00, 0x2E, 0x73, 0x74, 0x72, 0x74,
        0x61, 0x62, 0x00, 0x2E, 0x73, 0x68, 0x73, 0x74, 0x72, 0x74,
        0x61, 0x62, 0x00, 0x2E, 0x74, 0x65, 0x78, 0x74, 0x00, 0x2E,
        0x72, 0x6F, 0x64, 0x61, 0x74, 0x61, 0x00, 0x2E, 0x62, 0x73,
        0x73, 0x00, 0x2E, 0x41, 0x52, 0x4D, 0x2E, 0x61, 0x74, 0x74,
        0x72, 0x69, 0x62, 0x75, 0x74, 0x65, 0x73, 0x00, 0x2E, 0x63,
        0x6F, 0x6D, 0x6D, 0x65, 0x6E, 0x74, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x1B, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x74, 0x00, 0x00, 0x00,
        0x78, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x21, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0xEC, 0x02, 0x00, 0x00,
        0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x29, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x03, 0x00,
        0x00, 0x00, 0x08, 0x00, 0x04, 0x00, 0xF3, 0x02, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x2E, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x70, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF3, 0x02, 0x00, 0x00,
        0x2C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x3E, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x30, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1F, 0x03, 0x00, 0x00,
        0x6E, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
        0x11, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x12, 0x08, 0x00, 0x00,
        0x47, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x90, 0x03, 0x00, 0x00,
        0x30, 0x03, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x24, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00,
        0x09, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0x06, 0x00, 0x00,
        0x52, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ];
    beforeAll(function () {
        elf = new ARM.Simulator.Elf.Elf32(bootImage);
    });
    beforeEach(function () {
        vm = new ARM.Simulator.Vm(6.9824, [
            new ARM.Simulator.Region(0x00000, 0x4000, null, ARM.Simulator.Region.NoWrite, elf.Segments.filter(function (s) { return s.VirtualAddress < 0x40000; })
                .map(function (s) { return { offset: s.VirtualAddress, data: s.Bytes }; })),
            new ARM.Simulator.Region(0x40000, 0x8000, null, null, elf.Segments.filter(function (s) { return s.VirtualAddress >= 0x40000; })
                .map(function (s) { return { offset: s.VirtualAddress, data: s.Bytes }; }))
        ]);
        var pic = new ARM.Simulator.Devices.PIC(0xE00010000, function (active_irq) {
            vm.Cpu.nIRQ = !active_irq;
        }, function (active_fiq) {
            vm.Cpu.nFIQ = !active_fiq;
        });
        vm.RegisterDevice(pic);
        uart0 = new ARM.Simulator.Devices.TL16C750(0xE0000000, function (active) {
            return pic.SetSignal(0, active);
        });
        var devices = [
            uart0,
            new ARM.Simulator.Devices.TL16C750(0xE0004000, function (active) { return pic.SetSignal(1, active); }),
            new ARM.Simulator.Devices.HD44780U(0xE0008000),
            new ARM.Simulator.Devices.Timer(0xE00014000, function (active) { return pic.SetSignal(2, active); }),
            new ARM.Simulator.Devices.Timer(0xE00018000, function (active) { return pic.SetSignal(3, active); }),
            new ARM.Simulator.Devices.GPIO(0xE0001C000, 2, function (port) { return 0; }, function (p, v, s, c, d) { }),
            new ARM.Simulator.Devices.DS1307(0xE00020000, new Date()),
            new ARM.Simulator.Devices.Watchdog(0xE00024000)
        ];
        for (var _i = 0, devices_2 = devices; _i < devices_2.length; _i++) {
            var dev = devices_2[_i];
            expect(vm.RegisterDevice(dev)).toBe(true);
        }
        vm.on('TL16C750.Data', function (args, sender) {
            if (sender == uart0)
                output = output + String.fromCharCode(args);
        });
    });
    afterEach(function () {
        if (output != '')
            console.log('UART0 output: ' + output);
        output = '';
    });
    it('Should run', function () {
        var s = "Hello World\n";
        vm.RunFor(100);
        for (var i = 0; i < s.length; i++)
            uart0.SerialInput(s.charCodeAt(i));
        vm.RunFor(1000);
    });
});
describe('Watchdog Tests', function () {
    var watchdog;
    var service;
    beforeAll(function () {
        jasmine.clock().install();
        jasmine.clock().mockDate();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        watchdog = new ARM.Simulator.Devices.Watchdog(0);
        service = new ARM.Simulator.Tests.MockService(58.9824);
        expect(watchdog.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        watchdog.OnUnregister();
    });
    var tick = function (ms) {
        service.Tick(ms);
        jasmine.clock().tick(ms);
    };
    it('Reset Values', function () {
        var registers = [
            [0x00, 0x5312ACED],
            [0x04, 0x00000FFF],
            [0x08, 0x00000000],
            [0x0C, 0x01FFFFFF]
        ];
        for (var _i = 0, registers_4 = registers; _i < registers_4.length; _i++) {
            var entry = registers_4[_i];
            var value = watchdog.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });
    it('Counter Timings #1', function () {
        var expectedTime = 8.388608 * 1000;
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        expect(service.RaisedEvents.length).toBe(0);
        tick(expectedTime - 10);
        expect(service.RaisedEvents.length).toBe(0);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        expect(service.RaisedEvents[0][0]).toBe('Watchdog.Reset');
    });
    it('Counter Timings #2', function () {
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        var expectedTime = 8.388608 * 1000;
        var current = 0x0FFF;
        expect(watchdog.Read(0x0C, ARM.Simulator.DataType.Word)).toBe(current);
        for (var i = 1; i <= 4; i++) {
            tick(expectedTime * 0.25);
            current = (0x0FFF * (1.0 - i * 0.25)) | 0;
            expect(watchdog.Read(0x0C, ARM.Simulator.DataType.Word)).toBe(current);
        }
    });
    it('Counter Reload', function () {
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        var start = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        expect(start).toBe(0x0FFF);
        tick(1000);
        var counter = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        expect(counter).toBeLessThan(start);
        watchdog.Write(8, ARM.Simulator.DataType.Word, 0xE51A);
        tick(10);
        watchdog.Write(8, ARM.Simulator.DataType.Word, 0xA35C);
        tick(10);
        var reloaded = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        expect(reloaded).toBeGreaterThan(counter);
    });
    it('Invalid Key Value', function () {
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        expect(service.RaisedEvents.length).toBe(0);
        tick(1000);
        expect(service.RaisedEvents.length).toBe(0);
        watchdog.Write(8, ARM.Simulator.DataType.Word, 0x12345678);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        expect(service.RaisedEvents[0][0]).toBe('Watchdog.Reset');
    });
    it('Cannot be disabled', function () {
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        tick(10);
        expect(watchdog.Read(0, ARM.Simulator.DataType.Word)).toBe(0xACED5312);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0x5312ACED);
        var counter = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        tick(10);
        expect(watchdog.Read(0, ARM.Simulator.DataType.Word)).toBe(0xACED5312);
        expect(watchdog.Read(0x0C, ARM.Simulator.DataType.Word)).toBeLessThan(counter);
        expect(watchdog.Read(4, ARM.Simulator.DataType.Word)).toBe(0x0FFF);
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x1234);
        tick(10);
        expect(watchdog.Read(4, ARM.Simulator.DataType.Word)).toBe(0x0FFF);
    });
});
//# sourceMappingURL=arm.js.map