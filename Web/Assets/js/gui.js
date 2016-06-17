$(function() {
  var doc = CodeMirror($('#editor').get(0), {
     mode:  "armv4t",
     theme: 'hopscotch'
  }),
    image = null,
    board = null;

  function initialize() {
    // Bootstrap tooltips are 'opt-in'.
    $('[data-toggle="tooltip"], [data-tooltip="tooltip"]').tooltip();
    $('[data-toggle="popover"]').popover();
    
    // Fetch all assembly listings and add them to the dropdown menu.
    $('script[type="text/arm-assembly"]').each(function() {
      if(!$(this).data('name'))
        return true; // continue;
      var that = $(this),
          a    = $('<a href="#">Load <b>' + $(this).data('name') + '</b></a>')
                  .click(function() {
                    doc.setValue(that.text().trim());
                  });
      $('<li />').append(a).appendTo($('#assemble-dropdown-menu'));
    });
    // Load the first listing in the list into the editor.
    $('#assemble-dropdown-menu a').first().click();
  }

  function assemble() {
    var s = $('#console').empty(),
        c = doc.getValue();
    // Try to assemble instructions into binary image.
    try {
      var start = new Date().getTime(),
          image = ARM.Assembler.Assembler.Assemble(c, {TEXT:0, DATA:0x40000}),
          took  = new Date().getTime() - start;
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
    board = new ARM.Simulator.Devboard(image);
    updateLabels();
  }

  function singleStep() {
    try {
      board.Step();
      updateLabels();
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
      image = buffer;
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
      board.Run(1000);
      updateLabels();
      if (simulationIsRunning) {
        window.setTimeout(function() { runSimulation(); }, 250);
      }
    } catch(e) {
      updateLabels();
      if (e == 'PowerOffException') {
        console.log('Received PowerOffException. Powering off DevBoard.');
        $('#console')
          .append('<br/>')
          .append('<span class="error">Received PowerOffException. Stopping Simulator.</span>');
        $('#execute').trigger('click');
      }
      else {
        console.log(e);
      }
    }
  }

  function updateLabels() {
    var regs = board.GetCpuRegs();
    updateGPRLabels(regs);
    updateCPSRLabels(regs);
    updateINSTLabel(regs);
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
    var cpsr = {
      N: (regs.Cpsr >>> 31) & 0x01,
      Z: (regs.Cpsr >>> 30) & 0x01,
      C: (regs.Cpsr >>> 29) & 0x01,
      V: (regs.Cpsr >>> 28) & 0x01,
      I: (regs.Cpsr >>>  7) & 0x01,
      F: (regs.Cpsr >>>  6) & 0x01,
      T: (regs.Cpsr >>>  5) & 0x01
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

  function updateINSTLabel(regs) {
    try {
      var instr = board.ReadMemory(regs.Gpr[15] - 4, ARM.Simulator.DataType.Word);
      $('#instr-grp').html(board.vm.Cpu.Decode(instr));
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


  initialize();

});

