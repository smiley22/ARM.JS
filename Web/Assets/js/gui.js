$(function() {
  var doc = CodeMirror($('#editor').get(0), {
     mode:  "armv4t",
     theme: 'hopscotch'
  }),
    image = null,
    board = null,
    _lcd  = null,
    keypressEventListener = null,
    keyupEventListener = null;

  function initialize() {
    // Disable browser caching for ajax requests.
    $.ajaxSetup({'cache':false});
    $('#editor > .CodeMirror').css('height', window.innerHeight * 0.80);
    // Bootstrap tooltips are 'opt-in'.
    $('[data-toggle="tooltip"], [data-tooltip="tooltip"]').tooltip();
    $('[data-toggle="popover"]').popover();

    var listings = {
      'Hello World'           : 'hello.s',
      'Serial I/O'            : 'sio.s',
      'Interrupt Controller'  : 'int.s',
      'Real-time Clock'       : 'rtc.s'
    };
    // Fetch all assembly listings and add them to the dropdown menu.
    var numListings = Object.keys(listings).length,
        numLoaded   = 0;
    $.each(listings, function(key, value) {
      $.get('Assets/listings/' + value, {}, function(text) {
        numLoaded++;
        var a = $('<a href="#">Load <b>' + key + '</b></a>')
                  .click(function() {
                    doc.setValue(text.trim());
                  });
        $('<li />').append(a).appendTo($('#assemble-dropdown-menu'));
        // Load 'Hello' listing in the list into the editor.
        if (key == 'Hello World')
          a.click();
      });
    });

    $(window).resize(function() {
      $('#editor > .CodeMirror').css('height', window.innerHeight * 0.80);
    });
  }

  function assemble() {
    var s = $('#console').empty(),
        c = doc.getValue();
    // Try to assemble instructions into binary image.
    try {
      var start = new Date().getTime();
      image = ARM.Assembler.Assembler.Assemble(c, {TEXT:0, DATA:0x40000});
      var took  = new Date().getTime() - start;
      s.append('<span class="success">0 error(s)</span>')
       .append('<br />')
       .append('Assembling instructions took ' + took + 'ms')
       .append('<br />');
      $('#run').removeAttr('disabled');
      // Load into VM.
      $('#reset-vm').trigger('click');
    } catch(e) {
      var msg = e.toString();
      console.error(e);
      // Extract line-number from stack-trace.
      var a = e.stack.split("\n");
      if(a[1].match(/^.*\/(.*):(.*):.*$/))
        msg = 'Exception in ' + RegExp.$1 + ' at line ' + RegExp.$2 + ': ' +
              '<span class="error-message">' + e.message + '</span>';
      $('#console').append(msg).append('<br />');
      $('#run').attr('disabled', 'disabled');
    }
  }

  function reset() {
    initializeBoard();
    updateLabels();

    $('[id^=led-]').removeClass('led-on');
  }

  function initializeBoard() {
    board = new ARM.Simulator.Devboard(image);

    board.on('TL16C750.Data', function(data) {
      $('#console').append(
        data == 10 // NL
        ? '<br />'
        : String.fromCharCode(data)
      );
    });

    board.on('LED.On', function(leds) {
      for(var i = 0; i < leds.length; i++)
        $('#led-' + leds[i]).addClass('led-on');
    });
    board.on('LED.Off', function(leds) {
      for(var i = 0; i < leds.length; i++)
        $('#led-' + leds[i]).removeClass('led-on');
    });
    
    if (_lcd != null)
      _lcd.remove();
    _lcd = new lcd(board, {
      secondDisplayLine: true,
      charactersPerLine: 16,
      domParent: '#lcd'
    });
    initButtons();
  }

  function initButtons() {
    // Remove in case already installed. This happens if dev-board is
    // being reset.
    if(keypressEventListener)
      window.removeEventListener('keypress', keypressEventListener);
    var that = this;
    keypressEventListener = function(e) {
      var charCode = (typeof e.which == "number") ? e.which : e.keyCode
      if (charCode < 48 || charCode > 57)
        return;
      var n = charCode - 48;
      if (n > 0 && n <= 8)
        n--;
      board.PushButton(n);
    }
    window.addEventListener('keypress', keypressEventListener);
    if(keyupEventListener)
      window.removeEventListener('keyup', keyupEventListener);
    keyupEventListener = function(e) {
      var charCode = (typeof e.which == "number") ? e.which : e.keyCode
      if (charCode < 48 || charCode > 57)
        return;
      var n = charCode - 48;
      if (n > 0 && n <= 8)
        n--;
      board.ReleaseButton(n);
    }
    window.addEventListener('keyup', keyupEventListener);
  }


  function singleStep() {
    try {
      var pc = board.GetCpuRegs().Gpr[15];
      board.Step();
      updateLabels(pc);
    } catch(e) {
      updateLabels();
      if (e == 'PowerOffException') {
        console.log('Received PowerOffException. Powering off DevBoard.');
        $('#console')
          .append('<br/>')
          .append('<span class="error">Received PowerOffException. Stopping Simulator.</span>');
      } else {
        console.log(e);
      }
    }
  }

  $('#assemble').click(assemble);
  $('#reset-vm').click(reset);
  $('#single-step').click(singleStep);
  $(document).on('keypress', function(e) {
    var key = String.fromCharCode(e.which);
    switch(key) {
      case 's':
          singleStep();
        break;
        case 'r':
          reset();
        break;
    }
  });


  $('#image').click(function() {
    $('#elf-input-file').click();
  });

  $('#elf-input-file').change(function(e) {
    var files = e.originalEvent.target.files;
    if (files.length == 0)
      return;
    var reader = new FileReader();
    reader.onloadend = function(t) {
      var buffer = new Uint8Array(t.target.result);
      image = [].slice.call(buffer);
      var s = $('#console').empty();
      try {
        $('#reset-vm').trigger('click');
        s.append('<span class="success">' + files[0].name + ' loaded</span>');
        $('#run').removeAttr('disabled');
      } catch(ex) {
        s.append('<br/>')
         .append('<span class="error">' + files[0].name + ': ' + ex + '</span>');
        $('#run').attr('disabled');
      }
    }
    reader.readAsArrayBuffer(files[0]);
  });

  $('#example-elf').click(function() {
    image = exampleELF;
    $('#reset-vm').trigger('click');
    var s = $('#console').empty();
    s.append('<span class="success">Example.ELF loaded</span>');
    $('#run').removeAttr('disabled');
  });

  var simulationIsRunning = false;

  $('#execute').click(function() {
    var _this = $(this);
    simulationIsRunning = _this.text() == 'Execute';
    _this.text(simulationIsRunning ? 'Stop' : 'Execute');
    if (simulationIsRunning) {
      _this.addClass('btn-danger').removeClass('btn-success');
      runSimulation();
    } else {
      _this.addClass('btn-success').removeClass('btn-danger');
    }
  });

  $('#mem-input').on('input', updateMEMLabels);

  function runSimulation() {
    try {
      var pc = board.GetCpuRegs().Gpr[15];
      board.Run(1000);
      updateLabels(pc);
      if (simulationIsRunning) {
        window.setTimeout(function() { runSimulation(); }, 0);
      }
    } catch(e) {
      updateLabels();
      if (e == 'PowerOffException') {
        console.log('Received PowerOffException. Powering off DevBoard.');
        $('#console')
          .append('<br/>')
          .append('<span class="error">Received PowerOffException. Stopping Simulator.</span>');
        $('#execute').trigger('click');
//        reset();
      }
      else {
        console.log(e);
      }
    }
  }

  function updateLabels(pc) {
    var regs = board.GetCpuRegs();
    updateGPRLabels(regs);
    updateCPSRLabels(regs);
    updateINSTLabel(regs, pc);
    updateMEMLabels();
  }

  function updateGPRLabels(regs) {
    for(var i in regs.Gpr) {
      if(!regs.Gpr.hasOwnProperty(i))
        continue;
      var elem = ($('#' + i).length) > 0 ? $('#' + i) : null;
      if(elem == null) {
        elem = $('<td class="cpu-reg-val" id="' + i + '"></td>');
        var t = $('<tr><td class="cpu-reg">' + i + '</td></tr>');
        t.append(elem);
        $('#cpu-regs').append(t);
      }
      regs.Gpr[i] = regs.Gpr[i] || 0;
      var old = elem.text(),
          n = '0x' + (regs.Gpr[i] >>> 0).toString(16).toUpperCase(),
          c = old != n ? 'val-changed' : '',
          span = $('<span class="' + c + '">' + n + '</span>').tooltip({
            title: regs.Gpr[i],
            placement: 'right',
            animation: false
          });
      elem.html(span);
    }
  }

  function updateCPSRLabels(regs) {
    var modes = { 0x10: 'User', 0x11: 'FIQ', 0x12: 'IRQ', 0x13: 'Supervisor',
      0x17: 'Abort', 0x1F: 'System', 0x1B: 'Undefined' };
    var cpsr = {
      N: (regs.Cpsr >>> 31) & 0x01,
      Z: (regs.Cpsr >>> 30) & 0x01,
      C: (regs.Cpsr >>> 29) & 0x01,
      V: (regs.Cpsr >>> 28) & 0x01,
      I: (regs.Cpsr >>>  7) & 0x01,
      F: (regs.Cpsr >>>  6) & 0x01,
      T: (regs.Cpsr >>>  5) & 0x01,
      Mode: modes[regs.Cpsr & 0x1F]
    };
    for(var o in cpsr) {
      var elem = ($('#' + o).length) > 0 ? $('#' + o) : null;
      if(elem == null) {
        elem = $('<td class="cpu-reg-val" id="' + o + '"></td>');
        var t = $('<tr><td class="cpu-reg" id="n-' + o + '">' + o + '</td></tr>');
        t.append(elem);
        $('#cpu-cpsr').append(t);
      }
      cpsr[o] = cpsr[o] || 0;
      var old = elem.text(),
          c = old != cpsr[o] ? 'val-changed' : '',
          span = $('<span class="' + c + '">' + cpsr[o] + '</span>');
      elem.html(span);
    }
  }

  function updateINSTLabel(regs, pc) {
    try {
      if(!pc)
        pc = regs.Gpr[15]- 4;
      instr = board.ReadMemory(pc, ARM.Simulator.DataType.Word);
      $('#instr-grp').html(decodeInstruction(instr));
      $('#instr-val').html('0x' + instr.toString(16).toUpperCase()).tooltip({
        title: '(0b' + instr.toString(2) + ')',
        placement: 'right',
        animation: false
      });
    } catch(e) {
      $('#instr-grp').html('NOP');
      $('#instr-val').html('0x' + '0'.toString(16).toUpperCase());
    }
  }

  function updateMEMLabels() {
    try {
      var v = $('#mem-input').val(),
          addr = parseMemAddress(v);
      $('#vm-mem tbody tr').each(function() {
        $(this).children('td.cpu-reg').first().text('0x' + ('00000000' +
          addr.toString(16).toUpperCase()).substr(-8));
        var bytes = [],
            word = 0;
        // Read bytes rather than words as words must be aligned on word boundaries.
        for(var i = 0; i < 4; i++)
          word = word + ((board.ReadMemory(addr + i, ARM.Simulator.DataType.Byte) << (8 * i)) >>> 0);
        $(this).children('td:nth-child(2)').first().text('0x' + ('00000000' +
          word.toString(16).toUpperCase()).substr(-8)).tooltip({
          title: word,
          placement: 'right',
          animation: false
        });
        addr = addr + 4;
      });
    } catch(e) {
      if(e != 'Not a valid memory-address')
        console.log(e);
    }
  }

  function parseMemAddress(v) {
    if(!v)
      return 0;
    var m = v.match(/(?:0x)?([\da-h]{8})/i);
    if(!m)
      throw 'Not a valid memory-address';
    return parseInt(m[1], '16');
  }
  
  function decodeInstruction(iw) {
    var dataOps = ['and', 'eor', 'sub', 'rsb', 'add', 'adc', 'sbc', 'rsc',
      'tst', 'teq', 'cmp', 'cmn', 'orr', 'mov', 'bic', 'mvn'];
    switch ((iw >> 25) & 0x07) {
      case 0:
        if (!(((iw >> 4) & 0x1FFFFF) ^ 0x12FFF1))
          return 'bx';
        var b74 = (iw >> 4) & 0xF;
        if (b74 == 9)
          return ((iw >> 24) & 0x01) ? 'swi' :
                 (((iw >> 23) & 0x01) ? (((iw >> 22) & 0x01) ?
          (((iw >> 21) & 0x01) ? 'umlal' : 'umull') : (((iw >> 21) & 0x01) ? 'mlal' : 'mull')) :
          (((iw >> 21) & 0x01) ? 'mla' : 'mul'));
        if (b74 == 0xB || b74 == 0xD || b74 == 0xF)
          return ((iw >> 20) & 0x1) ? (((iw >> 5) & 0x1) ? (((iw >> 6) & 0x1) ?
            'ldrsh' : 'ldrh') : 'ldrsb') : 'strh';
        if (((iw >> 23) & 0x03) == 2 && !((iw >> 20) & 0x01))
          return ((iw >> 21) & 0x01) ? 'msr' : 'mrs';
         return dataOps[(iw >> 21) & 0xF];
       case 1:
         if (((iw >> 23) & 0x03) == 2 && !((iw >> 20) & 0x01))
          return ((iw >> 21) & 0x01) ? 'msr' : 'mrs';
          return dataOps[(iw >> 21) & 0xF];
        case 2: return ((iw >> 20) & 0x01) ? 'ldr' : 'str';
        case 3: return ((iw >> 4) & 0x01) ? 'undefined' :
          (((iw >> 20) & 0x01) ? 'ldr' : 'str');
        case 4: return ((iw >> 20) & 0x01) ? 'ldm' : 'stm';
        case 5: return ((iw >> 24) & 0x01) ? 'bl' : 'b';
        case 6: return ((iw >> 20) & 0x01) ? 'ldc' : 'stc';
        case 7:
          if ((iw >> 24) & 0x01)
            return 'swi';
          return ((iw >> 4) & 0x01) ?
            (((iw >> 20) & 0x01) ? 'mrc' : 'mcr') : 'cdp';
     }
     return 'undefined';
  }



  initialize();

});

