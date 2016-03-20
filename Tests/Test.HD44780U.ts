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
        // Reset, Read AC, should be 0. Perform Cursor Shift. Read AC again, should now be 1.
        issueCommand(0x01); // Clear Display
        tick(10);
        // Read AC
        expect(readAddressCounter()).toBe(0);
        // Perform a cursor shift.
        issueCommand(0x10);
        tick(10);
        expect(readAddressCounter()).toBe(1);
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
        // Set DDRAM address to random address. Write to DDRAM. Expect Address counter to
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
    });

    // TODO:
    //  Test edge-cases
    //    - decrement AC when AC = 0
    //    - increment AC when 0x3F (CG) or 0x7F (DD)
    //  Test display shift
});