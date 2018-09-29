

let impl = null;

if(global.PROFILER_ENABLED) {
    impl = require('profiler.screeps');
}
else {
    impl = require('profiler.noop');
}

module.exports = {
    enable: impl.enable,
    isEnabled: impl.isEnabled,
    wrap: impl.wrap,
    registerClass: impl.registerClass,
    registerFN: impl.registerFN,
};