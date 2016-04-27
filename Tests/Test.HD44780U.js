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
//# sourceMappingURL=Test.HD44780U.js.map