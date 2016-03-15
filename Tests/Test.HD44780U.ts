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
     */
    var issueCommand = (word: number) => {
        var values = [
            [0x00, 0x04],   // RS Low, RW Low, E High
            [0x04, word],   // Write command
            [0x00, 0x00]    // E Low
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
        // Lower 6 bits contain DD/CG-Ram address.
        return ((ret >> 7) & 0x01) == 1;
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
});