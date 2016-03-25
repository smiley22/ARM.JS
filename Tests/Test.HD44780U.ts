///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/HD44780U.ts"/>

/**
 * Contains unit-tests for the HD44780U device.
 */
describe('HD44780U Tests', () => {
    var lcd: ARM.Simulator.Devices.HD44780U;
    var service: ARM.Simulator.Tests.MockService;

    /**
     * Sets up the text fixture. Runs before the first test is executed.
     */
    beforeAll(() => {
        // Hooks JS' setTimeout and setInterval functions, so we can test timing-dependent code.
        jasmine.clock().install();
    });

    /**
     * Tear down the test fixture. Runs after all test methods have been run.
     */
    afterAll(() => {
        jasmine.clock().uninstall();
    });

    /**
     * Runs before each test method is executed.
     */
    beforeEach(() => {
        lcd = new ARM.Simulator.Devices.HD44780U(0);
        service = new ARM.Simulator.Tests.MockService();
        expect(lcd.OnRegister(service)).toBe(true);
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
        lcd.OnUnregister();
    });

    /**
     * Issues a command (instruction) to the LCD controller.
     * 
     * @param word
     *  The 8-bit instruction word.
     * @param rw
     *  The R/W signal. true for logical 1; false for logical 0.
     * @param rs
     *  The RS signal. true for logical 1; false for logical 0.
     */
    var issueCommand = (word: number, rw = false, rs = false) => {
        var pattern = (rs ? 1 : 0) + (rw ? 2 : 0);
        var values = [
            [0x00, pattern | 0x04],   // RS = rs, RW = rw, E High
            [0x04, word],             // Write command
            [0x00, pattern]           // E Low
        ];
        for (var pair of values)
            lcd.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
    }

    /**
     * Reads and returns the status of the busy flag (BF) of the LCD controller.
     * 
     * @return
     *  true if the busy flag is set; otherwise false.
     */
    var checkBusyFlag = () => {
        var values = [
            [0x00, 0x06],   // RS Low, RW High, E High
            [0x00, 0x02]    // RS Low, RW High, E Low
        ];
        for (var pair of values)
            lcd.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
        // Read result.
        var ret = lcd.Read(0x04, ARM.Simulator.DataType.Word);
        // Lower 7 bits contain DD/CG-Ram address.
        return ((ret >> 7) & 0x01) == 1;
    }

    /**
     * Reads and returns the value of the address counter of the LCD controller.
     * 
     * @return
     *  The value of the address counter.
     */
    var readAddressCounter = () => {
        var values = [
            [0x00, 0x06],   // RS Low, RW High, E High
            [0x00, 0x02]    // RS Low, RW High, E Low
        ];
        for (var pair of values)
            lcd.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
        // Read result.
        var ret = lcd.Read(0x04, ARM.Simulator.DataType.Word);
        // Lower 7 bits contain DD/CG-Ram address.
        return (ret & 0x7F);
    }

    /**
     * Reads data from CG or DDRAM.
     * 
     * @return
     *  The 8-bit data word read from CG or DDRAM.
     */
    var readRam = () => {
        issueCommand(0x00, true, true);
// ReSharper disable once VariableUsedInInnerScopeBeforeDeclared
        tick(10);
        // Read data-bus.
        var ret = lcd.Read(0x04, ARM.Simulator.DataType.Word);
        return (ret & 0xFF);
    }

    /**
     * Advances the simulation time by the specified amount of milliseconds.
     * 
     * @param ms
     *  The amount of milliseconds to advance time.
     */
    var tick = (ms: number) => {
        jasmine.clock().tick(ms);
    }

    /**
     * Ensures busy flag is being set after a command has been sent and is cleared
     * after a command has been performed.
     */
    it('Busy Flag', () => {
        expect(checkBusyFlag()).toBe(false);
        // Perform a 'Function Set' instruction.
        issueCommand(0x30);
        // Device should be busy performing the instruction indicated by a set busy-flag.
        expect(checkBusyFlag()).toBe(true);
        tick(10);
        // Most instructions take 37µs so by now device should be idle again.
        expect(checkBusyFlag()).toBe(false);
    });

    /**
     * Ensures instructions take the proper amount of time to execute.
     */
    it('Instruction Timings', () => {
        // Most instructions take 37 µs to execute.
        var expectedTime = .037;
        var returnHome = 1.52;
        var instructions = [
            0x04, // 'Entry Mode set'
            0x08, // 'Display on/off control'
            0x10, // 'Cursor or Display shift'
            0x20, // 'Function set'
            0x40, // 'Set CGRAM address'
            0x80  // 'Set DDRAM address'
        ];
        for (var inst of instructions) {
            issueCommand(inst);
            expect(checkBusyFlag()).toBe(true);
            tick(expectedTime * .5);
            expect(checkBusyFlag()).toBe(true);
            tick(expectedTime * .5 + .01);
            expect(checkBusyFlag()).toBe(false);
        }
        // 'Return Home' instruction takes 1.52 ms.
        issueCommand(0x02);
        expect(checkBusyFlag()).toBe(true);
        tick(returnHome * .5);
        expect(checkBusyFlag()).toBe(true);
        tick(returnHome * .5 + .01);
        expect(checkBusyFlag()).toBe(false);
    });

    /**
     * Tests the 'Clear Display' command.
     */
    it('Clear Display', () => {
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
        for (var i of args.ddRam)
            expect(i).toBe(0x20); // 0x20 = Space character
    });

    /**
     * Tests the 'Return Home' command.
     */
    it('Return Home', () => {
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

    /**
     * Tests the 'Entry Mode Set' command.
     */
    it('Entry Mode Set', () => {
        var entryModeSetCmd = 0x04; // I/D = 0, S = 0
        issueCommand(entryModeSetCmd);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        var ev = service.RaisedEvents[0];
        expect(ev[0]).toBe('HD44780U.EntryModeSet');
        var args = ev[1];
        expect(args.incrementAddressCounter).toBeDefined();
        expect(args.incrementAddressCounter).toBe(false);
        // I/D = 1, S = 0
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

    /**
     * Tests the 'Display On/Off Control' command.
     */
    it('Display On/Off Control', () => {
        var dispControlCmd = 0x08; // D = 0, C = 0, B = 0
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
        // D = 1, C = 1, B = 1
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

    /**
     * Tests the 'Cursor or Display Shift' command.
     */
    it('Cursor or Display Shift', () => {
        issueCommand(0x01); // Clear Display
        tick(10);
        var ev = service.RaisedEvents[0];
        expect(ev[0]).toBe('HD44780U.ClearDisplay');
        // Perform a cursor shift.
        issueCommand(0x10);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(1);
        ev = service.RaisedEvents[1];
        expect(ev[0]).toBe('HD44780U.CursorShift');
    });

    /**
     * Tests the 'Set CGRAM address' command.
     */
    it('Set CGRAM address', () => {
        // Set CGRam address to some random (6-bit) value.
        var cgAddress = 0x1B;
        issueCommand(0x40 | cgAddress);
        tick(10);
        // Reading out address should return same value (setting CGRam address implicitly
        // switches address-counter to CG-Ram).
        expect(readAddressCounter()).toBe(cgAddress);
        // Reset address to 0.
        issueCommand(0x40);
        tick(10);
        expect(readAddressCounter()).toBe(0);
    });

    /**
     * Tests the 'Set DDRAM address' command.
     */
    it('Set DDRAM address', () => {
        // Set DDRam address to some random (7-bit) value.
        var ddAddress = 0x6B;
        issueCommand(0x80 | ddAddress);
        tick(10);
        // Reading out address should return same value (setting DDRam address implicitly
        // switches address-counter to DD-Ram).
        expect(readAddressCounter()).toBe(ddAddress);
        // Reset address to 0.
        issueCommand(0x80);
        tick(10);
        expect(readAddressCounter()).toBe(0);
    });

    /**
     * Tests the 'Write to RAM' and 'Read from RAM' commands.
     */
    it('Write data to RAM', () => {
        // Set DDRAM address to random address. Write to DDRAM. Expect address counter to
        // have been incremented. Reset address counter to previous address. Read DDRAM.
        // Read out value should be value we put in earlier.
        var ddAddress = 0x33;
        var ddValue = 'A'.charCodeAt(0);
        issueCommand(0x80 | ddAddress);
        tick(10);
        expect(readAddressCounter()).toBe(ddAddress);
        // Write data        
        issueCommand(ddValue, false, true);
        tick(10);
        expect(readAddressCounter()).toBe(ddAddress + 1);
        // Reset AC
        issueCommand(0x80 | ddAddress);
        tick(10);
        var readValue = readRam();
        expect(readValue).toBe(ddValue);
        // Reading also increments the address counter.
        expect(readAddressCounter()).toBe(ddAddress + 1);
    });

    /**
     * Ensures the specified event has been raised.
     * 
     * @param event
     *  The name of the event.
     * @param properties
     *  A set of expected event properties.
     * @return
     *  The set of properties of the raised event.
     */
    var expectEvent = (event: string, properties: any = null) => {
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
    }

    /**
     * Replays the 'Initializing by Instruction' scenario outlined in the HD44780U
     * manual (p. 45).
     */
    it('Initializing by Instruction', () => {
        // Power on.
        tick(15);               // Wait for more than 15 ms
        issueCommand(0x30);     // Function set (Interface is 8 bits long.)
        tick(4.1);              // Wait for more than 4.1 ms
        expectEvent('HD44780U.FunctionSet');
        issueCommand(0x30);     // Function set (Interface is 8 bits long.)
        tick(0.1);              // Wait for more than 100 µs.
        expectEvent('HD44780U.FunctionSet');
        issueCommand(0x30);     // Function set (Interface is 8 bits long.)
        tick(0.1);
        expectEvent('HD44780U.FunctionSet');
        issueCommand(0x08);     // Display off
        tick(0.1);
        expectEvent('HD44780U.DisplayControl');
        issueCommand(0x01);     // Display clear
        tick(0.1);
        expectEvent('HD44780U.ClearDisplay');
        issueCommand(0x07);     // Entry mode set
        tick(0.1);
        expectEvent('HD44780U.EntryModeSet');
    });

    /**
     * Issues the specified command and subsequently waits for the LCD controller to
     * become idle again.
     * 
     * @param word
     *  The 8-bit instruction word.
     * @param rw
     *  The R/W signal. true for logical 1; false for logical 0.
     * @param rs
     *  The RS signal. true for logical 1; false for logical 0.
     */
    var issueCommandAndWait = (word: number, rw = false, rs = false) => {
        issueCommand(word, rw, rs);
        tick(0.1); // Wait for 100µs.
    };

    /**
     * Writes the specified character and ensures it's been written to DDRAM.
     * 
     * @param character
     *  The character to write.
     */
    var writeCharacter = (character: string) => {
        issueCommandAndWait(character.charCodeAt(0), false, true);
        var props = expectEvent('HD44780U.DataWrite');
        expect(props.ddRam).toBeDefined();
        expect(props.addressCounter).toBeDefined();
        var index = props.addressCounter - 1;
        if (props.secondDisplayLine && index >= 0x40)
            index = index - 0x18;
        expect(props.ddRam[index]).toBe(character.charCodeAt(0));
    }

    /**
     * Replays the '8-Bit Operation, 8-Digit × 1-Line Display Example with Internal Reset'
     * scenario outlined in the HD44780U manual (p. 40).
     */
    it('1-Line Display Example', () => {
        // 1. Power supply on (the HD44780U is initialized by the internal reset circuit)
        issueCommandAndWait(0x30);  // 2. Function Set.
        expectEvent('HD44780U.FunctionSet', { secondDisplayLine: false });
        issueCommandAndWait(0x0E);  // 3. Display on/off control.
        expectEvent('HD44780U.DisplayControl', {
            displayEnabled: true,
            showCursor: true,
            cursorBlink: false
        });
        issueCommandAndWait(0x06); // 4. Entry mode set.
        expectEvent('HD44780U.EntryModeSet', {
            incrementAddressCounter: true,
            shiftDisplay: false
        });
        // 5-8. Write Data.
        for (let c of 'HITACHI')
            writeCharacter(c);
        // 9. Entry mode set.
        issueCommandAndWait(0x07);
        expectEvent('HD44780U.EntryModeSet', {
            incrementAddressCounter: true,
            shiftDisplay: true
        });
        writeCharacter(' '); // 10. Write Data.
        // 11-13. Write Data.
        for (let c of 'MICROKO')
            writeCharacter(c);
        // 14. Cursor or display shift.
        issueCommandAndWait(0x10);
        expectEvent('HD44780U.CursorShift');
        // 15. Cursor or display shift.
        issueCommandAndWait(0x10);
        expectEvent('HD44780U.CursorShift');
        // 16. Write Data.
        writeCharacter('C');
        // 17. Cursor or display shift.
        issueCommandAndWait(0x1C);
        expectEvent('HD44780U.DisplayShift');
        // 18. Cursor or display shift.
        issueCommandAndWait(0x14);
        expectEvent('HD44780U.CursorShift');
        // 19-20. Write Data.
        for(let c of 'MPUTER')
            writeCharacter(c);
        // 21. Return home.
        issueCommandAndWait(0x02);
        expectEvent('HD44780U.ReturnHome', { addressCounter: 0 });
        // DDRAM should now contain the characters 'HITACHI MICROCOMPUTER'.
        for (let c of 'HITACHI MICROCOMPUTER')
            expect(readRam()).toBe(c.charCodeAt(0));
    });

    /**
     * Replays the '8-Bit Operation, 8-Digit × 2-Line Display Example with Internal Reset'
     * scenario outlined in the HD44780U manual (p. 43).
     */
    it('2-Line Display Example', () => {
        // 1. Power supply on (the HD44780U is initialized by the internal reset circuit)
        issueCommandAndWait(0x38);  // 2. Function Set.
        expectEvent('HD44780U.FunctionSet', { secondDisplayLine: true });
        issueCommandAndWait(0x0E);  // 3. Display on/off control.
        expectEvent('HD44780U.DisplayControl', {
            displayEnabled: true,
            showCursor: true,
            cursorBlink: false
        });
        issueCommandAndWait(0x06); // 4. Entry mode set.
        expectEvent('HD44780U.EntryModeSet', {
            incrementAddressCounter: true,
            shiftDisplay: false
        });
        // 5-7. Write Data.
        for (let c of 'HITACHI')
            writeCharacter(c);
        // 8. Set DDRAM address.
        issueCommandAndWait(0xC0);
        expect(readAddressCounter()).toBe(0x40);
        // Reset because read caused address counter increment.
        issueCommandAndWait(0xC0);
        // 9-11. Write Data.
        for (let c of 'MICROCO')
            writeCharacter(c);
        // 12. Entry mode set.
        issueCommandAndWait(0x07);
        expectEvent('HD44780U.EntryModeSet', {
            incrementAddressCounter: true,
            shiftDisplay: true
        });
        // 13-14. Write Data.
        for (let c of 'MPUTER')
            writeCharacter(c);
        // 15. Return home.
        issueCommandAndWait(0x02);
        expectEvent('HD44780U.ReturnHome', { addressCounter: 0 });
        // DDRAM should now contain the characters 'HITACHI' starting at offset 0x00 and the
        // characters 'MICROCOMPUTER' starting at offset 0x40.
        for (let c of 'HITACHI')
            expect(readRam()).toBe(c.charCodeAt(0));
        // Set DDRAM address to 0x40.
        issueCommandAndWait(0xC0);
        for (let c of 'MICROCOMPUTER')
            expect(readRam()).toBe(c.charCodeAt(0));
    });
});