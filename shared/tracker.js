/* ============================================================
   PETE 346 – Progress Tracker  |  shared/tracker.js
   Shared library used by all activity pages and hub pages.
   ============================================================ */

window.PETE346 = (function () {

  const PASSING_PCT = 70;

  function _key(module, activity) {
    return 'pete346_m' + module + '_' + activity;
  }

  function _get(module, activity) {
    try {
      var raw = localStorage.getItem(_key(module, activity));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function _save(module, activity, pct, weaknesses, title) {
    var prev = _get(module, activity);
    var passed = pct >= PASSING_PCT;
    var data = {
      percentage : pct,
      weaknesses : weaknesses || [],
      title      : title || activity,
      passed     : passed,
      completedAt: new Date().toISOString(),
      attempts   : ((prev && prev.attempts) || 0) + 1,
      bestScore  : Math.max(pct, (prev && prev.bestScore) || 0)
    };
    localStorage.setItem(_key(module, activity), JSON.stringify(data));
    return data;
  }

  /* Called by activity pages on completion */
  function reportCompletion(pct, weaknesses, title) {
    var cfg = window.PETE346_CONFIG || {};
    var module   = cfg.module;
    var activity = cfg.activity;
    if (!module || !activity) return;

    var pctNum = parseInt(pct, 10) || 0;
    var data = _save(module, activity, pctNum, weaknesses, title || cfg.title);

    /* Notify parent hub frame */
    if (window.parent !== window) {
      try {
        window.parent.postMessage({
          type     : 'pete346_complete',
          module   : module,
          activity : activity,
          percentage: pctNum,
          passed   : data.passed,
          weaknesses: data.weaknesses,
          title    : data.title
        }, '*');
      } catch (e) {}
    }
  }

  /* Student name helpers */
  function getStudentName() {
    return localStorage.getItem('pete346_student_name') || '';
  }
  function setStudentName(name) {
    localStorage.setItem('pete346_student_name', name.trim());
  }

  /* Public API */
  return {
    PASSING_PCT    : PASSING_PCT,
    get            : _get,
    save           : _save,
    reportCompletion: reportCompletion,
    getStudentName : getStudentName,
    setStudentName : setStudentName,

    /* Returns array of {activity, data} for a module */
    getModuleProgress: function (module, activities) {
      return activities.map(function (a) {
        return { activity: a, data: _get(module, a) };
      });
    },

    /* True only when every activity is passed */
    isModuleComplete: function (module, activities) {
      return activities.every(function (a) {
        var d = _get(module, a);
        return d && d.passed;
      });
    },

    /* Index of first unpassed activity, or -1 if all done */
    nextIncomplete: function (module, activities) {
      for (var i = 0; i < activities.length; i++) {
        var d = _get(module, activities[i]);
        if (!d || !d.passed) return i;
      }
      return -1;
    }
  };
})();
