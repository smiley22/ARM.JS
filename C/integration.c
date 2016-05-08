#include "devboard.h"

void sio_init() {
    U0IER = 0;      /* Disable all interrupts */
	U0LCR = 0x80;   /* Enable DLAB */
    U0DLL = 0x03;
    U0DLH = 0;      /* 38400 baud */
    U0LCR = 0x03;   /* 8 bits, no parity, one stop bit */
    U0FCR = 0xC7;   /* Enable FIFOs, clear them, 14-byte threshold */
}

void sio_putc(char c) {
    /* FIFO full */
    while (!(U0LSR & 0x20))
        ;
    U0THR = c;
}

void sio_puts(char *s) {
    while (*s) {
        sio_putc(*s);
        s++;
    }
}

int main() {
    sio_init();
    sio_puts("Hello");
    return 0;
}
