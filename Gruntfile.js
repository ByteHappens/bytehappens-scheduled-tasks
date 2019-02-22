module.exports = function(grunt) {
  grunt.loadNpmTasks("grunt-ts");
  grunt.loadNpmTasks("grunt-contrib-watch");

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
    ts: {
      default: {
        tsconfig: true
      }
    },
    watch: {
      scripts: {
        files: ["src/**/*.ts"],
        tasks: ["build"],
        options: {
          spawn: false
        }
      }
    }
  });

  // Default task(s).
  grunt.registerTask("default", [""]);
  grunt.registerTask("build", ["ts"]);
};
