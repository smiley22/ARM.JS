#include "devboard.h"

void lcd_init();
void lcd_puts(char *s);
void lcd_putc(char c);
void lcd_seek(unsigned char pos);
void lcd_home();
void lcd_clear();
void lcd_command(unsigned char command);

int main() {
  lcd_init();
  lcd_puts("Hello World from C");
  lcd_seek(0x40);
  lcd_puts("Second Line");
  return 0;
}

void lcd_init() {
  /* Set to 8-bit operation and select 2-line display and 5 × 8 dot character
     font (Number of display lines and character fonts cannot be changed after
     this). */
  lcd_command(0x38);
  /* Turn on display and cursor. Entire display is in space mode because of
     initialization. */
  lcd_command(0x0E);
  /* Set mode to increment the address by one and to shift the cursor to the
     right at the time of write to the DD/CGRAM. Display is not shifted. */
  lcd_command(0x06);
}

void lcd_puts(char *s) {
  while(*s) {
    lcd_putc(*s);
    s++;
  }
}

void lcd_putc(char c) {
  LCDIOCTL = 0x05;
  LCDDATA  = c;
  LCDIOCTL = 0x01;
}

void lcd_seek(unsigned char pos) {
  lcd_command(pos | (1 << 7));
}

void lcd_home() {
  lcd_command(0x02);
}

void lcd_clear() {
  lcd_command(0x01);
}

void lcd_command(unsigned char command) {
  LCDIOCTL = 0x04; /* set E high */
  LCDDATA  = command;
  LCDIOCTL = 0x00; /* set E low */
}

void delay() {
    int i;
    for(i = 0; i < 200000; i++)
        ;
}