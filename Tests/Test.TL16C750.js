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
        for (var _i = 0, registers_1 = registers; _i < registers_1.length; _i++) {
            var entry = registers_1[_i];
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
        for (var _i = 0, values_1 = values; _i < values_1.length; _i++) {
            var pair = values_1[_i];
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
        for (var _i = 0, values_2 = values; _i < values_2.length; _i++) {
            var pair = values_2[_i];
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
        for (var _i = 0, values_3 = values; _i < values_3.length; _i++) {
            var pair = values_3[_i];
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
//# sourceMappingURL=Test.TL16C750.js.map