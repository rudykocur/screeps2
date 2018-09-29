module.exports = {
    enable: () => {},
    isEnabled: () => false,
    wrap: callback => callback(),
    registerClass: () => {},
    registerFN: fn => fn,
};