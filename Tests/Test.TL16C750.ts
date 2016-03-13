///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/TL16C750.ts"/>

/**
 * Contains unit-tests for the TL16C750 device.
 */
describe('TL16C750 Tests', () => {
    var uart: ARM.Simulator.Devices.TL16C750;
    var service = new ARM.Simulator.Tests.MockService();

    /**
     * Set up the test fixture. Runs before any test methods are executed.
     */
    beforeAll(() => {
        uart = new ARM.Simulator.Devices.TL16C750(0, active => {
        });
        expect(uart.OnRegister(service)).toBe(true);
    });

    /**
     * Tear down the test fixture. Runs after all test methods have run.
     */
    afterAll(() => {
        uart.OnUnregister();
    });

    /**
     * Ensures UART registers contain expected reset values after a master reset.
     * See TL16C750 Manual 'Principles Of Operation'.
     */
    it('Function Reset', () => {
        var registers = [
            // Interrupt Enable Register (IER).
            // All bits cleared (0–5 forced and 6–7 permanent).
            [0x04, 0x00],
            // Interrupt Identification Register (IIR).
            // Bit 0 is set, bits 1–4 are cleared, and bits 5–7 are cleared.
            [0x08, 0x01],
            // Line Control Register (LCR).
            // All bits cleared.
            [0x0C, 0x00],
            // Modem Control Register (MCR).
            // All bits cleared.
            [0x10, 0x00],
            // Line Status Register (LSR).
            // Bits 5 and 6 are set, all other bits are cleared.
            [0x14, 0x60]
        ];
        for (var entry of registers) {
            var value = uart.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });

    it('Serial IO', () => {
        // Init sequence taken from random source (http://wiki.osdev.org/Serial_Ports).
        var values = [
            [0x04, 0x00],   // Disable all interrupts
            [0x0C, 0x80],   // Enable DLAB (set baud rate divisor)
            [0x00, 0x03],   // Set divisor to 3 (lo byte) 38400 baud
            [0x04, 0x00],   //                  (hi byte)
            [0x0C, 0x03],   // 8 bits, no parity, one stop bit
            [0x08, 0xC7],   // Enable FIFO, clear them, with 14-byte threshold
            [0x10, 0x0B]    // IRQs enabled, RTS/DSR set
        ];
        for (var pair of values)
            uart.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
        var chars = ['H', 'e', 'l', 'l', 'o'];
        for (var c of chars) {
            uart.Write(0, ARM.Simulator.DataType.Word, c.charCodeAt(0));
            service.Tick(20);
        }
        expect(service.RaisedEvents.length).toBe(5);
        for (var i = 0; i < service.RaisedEvents.length; i++)
            expect(service.RaisedEvents[i][1] === chars[i].charCodeAt(0));
    });
});