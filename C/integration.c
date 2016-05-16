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

char sio_getc() {
    while (!(U0LSR & 0x01))
        ;
    return U0RBR;
}

char *sio_gets() {
    static char buf[256];
    int i = 0;
    char c;
    while (c = sio_getc()) {
        buf[i++] = c;
        if (c == '\n')
            break;
    }
    buf[i] = 0;
    return buf;
}

int main() {
    char c;
    sio_init();
    sio_puts("echo: ");
//    while ((c = sio_getc()) != '\n')
//        sio_putc(c);
    sio_puts(sio_gets());
    return 0;
}
