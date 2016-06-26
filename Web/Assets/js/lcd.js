var lcd = function(service, opts) {
  this.dom = $('<div class="lcd"/>');
  this.shiftOffset       = 0;
  this.charsPerLine      = 8;
  this.secondDisplayLine = false;
  
  this.ctor = function () {
    if (opts && opts.charactersPerLine)
      this.charsPerLine = opts.charactersPerLine;
    if (opts && opts.domParent)
      $(opts.domParent).append(this.dom);
    if (opts && opts.secondDisplayLine)
      this.secondDisplayLine = true;
    var that = this;
    service
      .on('HD44780U.ClearDisplay', function(a) {
        that.clearDisplay.call(that, a);
      })
      .on('HD44780U.DisplayControl', function(a) {
        that.displayControl.call(that, a);
      })
      .on('HD44780U.DataWrite', function(a) {
        that.dataWrite.call(that, a);
      })
      .on('HD44780U.DataRead', function(a) {
        that.dataRead.call(that, a);
      })
      .on('HD44780U.CursorShift', function(a) {
        that.cursorShift.call(that, a);
      })
      .on('HD44780U.DisplayShift', function(a) {
        that.displayShift.call(that, a);
      })
      .on('HD44780U.ReturnHome', function(a) {
        that.returnHome.call(that, a);
      })
      .on('HD44780U.DDRamAddressSet', function(a) {
        that.ddRamAddressSet.call(that, a);
      });

    this.buildDOM();
  }
  
  this.buildDOM = function () {
    for (var i = 0; i < (this.secondDisplayLine ? 2 : 1); i++) {
      var l = $('<div class="lcd-line"/>');
      for (var c = 0; c < this.charsPerLine; c++) {
        l.append('<div class="lcd-cell lcd-row-' + i + '" id="lcd-cell-' +
          (i * this.charsPerLine + c) + '"></div>');
      }
      this.dom.append(l);
    }
  }
  
  this.clearDisplay = function(args) {
    this.shiftOffset = 0;
    this.updatePanel(args);
    this.updateCursor(args);
  }
  
  this.displayControl = function(args) {
    this.dom.parent().toggleClass('lcd-on', args.displayEnabled);
    this.updateCursor(args);
  }
  
  this.dataWrite = function(args) {
    this.updateShiftOffset(args);
    this.updatePanel(args);
    this.updateCursor(args);
  }
  
  this.dataRead = function(args) {
    this.updateCursor(args);
  }
  
  this.cursorShift = function(args) {
    this.updateCursor(args);
  }
  
  this.displayShift = function(args) {
    this.updateShiftOffset(args, args.shiftRight);
    this.updatePanel(args);
    this.updateCursor(args);
  }
  
  this.returnHome = function(args) {
    this.shiftOffset = 0;
    this.updatePanel(args);
    this.updateCursor(args);
  }
  
  this.ddRamAddressSet = function(args) {
    this.updateCursor(args);
  }
  
  this.updateCursor = function(args) {
    // Remove all styles
    this.dom.children('.lcd-line').children().removeClass('cursor blink');
    // If turned off, don't bother
    if (!args.displayEnabled || !args.showCursor)
      return;
    var cursorPos = args.addressCounter - this.shiftOffset;
    // Is cursor position outside of n-digit panel?
    var line = 'first';
    if (cursorPos < 0 || cursorPos > (this.charsPerLine - 1)) {
      if(!this.secondDisplayLine)
        return;
      if (cursorPos < 0x40 || cursorPos > (0x40 + (this.charsPerLine - 1)))
        return;
      else {
        line = 'nth-child(2)';
        cursorPos = cursorPos - 0x40;
      }
    }
    var cell = this.dom.children('.lcd-line:' + line)
      .children('div:nth-child(' + (1 + cursorPos) + ')')
      .addClass('cursor');
    if (args.cursorBlink)
      cell.addClass('blink');
  }
  
  this.updateShiftOffset = function(args, shiftRight) {
    if (!args.shiftDisplay)
      return;
    var inc = shiftRight !== undefined ? (!shiftRight) : args.incrementAddressCounter;
    this.shiftOffset = this.shiftOffset + (inc ? 1 : -1);
    var max = this.secondDisplayLine ? 40 : 80;
    if (this.shiftOffset == max)
      this.shiftOffset = 0;
    if (this.shiftOffset < 0)
      this.shiftOffset = max - 1;
  }
  
  this.updatePanel = function(args) {
    var cells = this.dom.children('.lcd-line:first').children(),
      i,
      ddIndex,
      character,
      max = this.secondDisplayLine ? 40 : 80;
    for (i = 0; i < this.charsPerLine; i++) {
      ddIndex = (this.shiftOffset + i) % max;
      character = args.characterRom[args.ddRam[ddIndex]];
      $(cells.get(i)).text(character);
    }
    if (!this.secondDisplayLine)
      return;
    cells = this.dom.children('.lcd-line:nth-child(2)').children();
    for (i = 0; i < this.charsPerLine; i++) {
      ddIndex = 40 + ((this.shiftOffset + i + 40) % max);
      character = args.characterRom[args.ddRam[ddIndex]];
      $(cells.get(i)).text(character);
    }
  }
  
  this.ctor.call(this, service, parent);
}
