var screepsConfig = require('./screepsConfig');

module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.initConfig({
        screeps: {

            dist: {
                options: {
                    email: screepsConfig.login,
                    password: screepsConfig.password,
                    branch: 'default',
                    ptr: false
                },
                src: ['src/*.js']
            },

            sim: {
                options: {
                    email: screepsConfig.login,
                    password: screepsConfig.password,
                    branch: 'sim',
                    ptr: false
                },
                src: ['sim/*.js']
            }
        },
        copy: {
            toSim: {
                files: [
                    {expand: true, cwd: 'src', src: ['**', '!main.js'], dest: 'sim/'}
                ]
            }
        }
    });

    grunt.registerTask('finished', 'finished', function() {
        grunt.log.ok('Upload finished at ' + new Date().toISOString().replace('T', ' '));
    });

    grunt.registerTask('screeps-main', ['screeps:dist', 'finished']);
    grunt.registerTask('screeps-sim', ['copy:toSim','screeps:sim'])
};