// React Native / Hermes v1 custom compatibility suite.
//
// Reproducers for the three Hermes v1 codegen bugs that Expo's
// babel-preset-expo currently works around via:
//   - fix-hermes-v1-async-arrow-non-simple-params
//   - fix-hermes-v1-class-in-finally
//   - fix-hermes-v1-super-in-object-accessor
//
// Each test's exec function body (in /* */) is extracted and run inside
// Hermes. A test is marked PASS when it prints "[SUCCESS]" — done from
// inside async callbacks so microtasks complete before the runner reads
// stdout. Bug-affected paths either crash, throw, or silently return the
// wrong value (e.g. `undefined`), so [SUCCESS] is never emitted.
//
// References:
//   facebook/hermes#1761 (async arrow + non-simple params)
//   facebook/hermes@68bfb3a (fix)
//   facebook/hermes@1e94fbe (class-in-finally fix)
//   facebook/hermes@18a9634 (super-in-accessor fix)

module.exports = {
  tests: [
    {
      name: "async arrow with non-simple parameters",
      category: "syntax",
      subtests: [
        {
          name: "rest parameter",
          exec: function () {
            /*
            void (async (...args) => {
              var v = await Promise.resolve(args[0]);
              if (v === "ok") print("[SUCCESS]");
            })("ok");
            */
          },
        },
        {
          name: "default parameter",
          exec: function () {
            /*
            void (async (x = "ok") => {
              var v = await Promise.resolve(x);
              if (v === "ok") print("[SUCCESS]");
            })();
            */
          },
        },
        {
          name: "destructured parameter",
          exec: function () {
            /*
            void Promise.resolve(["a", "b"]).then(async ([a, b]) => {
              var v = await Promise.resolve("hello");
              if (v === "hello" && a === "a" && b === "b") print("[SUCCESS]");
            });
            */
          },
        },
      ],
    },
    {
      name: "class declaration in finally block",
      category: "syntax",
      subtests: [
        {
          name: "static field",
          exec: function () {
            /*
            function t() {
              try { throw 1; } finally {
                class C { static g = 42; }
                if (C.g === 42) print("[SUCCESS]");
              }
            }
            try { t(); } catch (e) {}
            */
          },
        },
        {
          name: "instance field",
          exec: function () {
            /*
            function t() {
              try { throw 1; } finally {
                class C { f = 52; }
                if (new C().f === 52) print("[SUCCESS]");
              }
            }
            try { t(); } catch (e) {}
            */
          },
        },
        {
          name: "private method",
          exec: function () {
            /*
            function t() {
              try { throw 1; } finally {
                class C {
                  #m() { return 62; }
                  call() { return this.#m(); }
                }
                if (new C().call() === 62) print("[SUCCESS]");
              }
            }
            try { t(); } catch (e) {}
            */
          },
        },
      ],
    },
    {
      name: "super in object literal accessor",
      category: "syntax",
      subtests: [
        {
          name: "non-computed getter",
          exec: function () {
            /*
            var proto = { m: function () { return "proto-m"; } };
            var obj = { get a() { return super.m(); } };
            Object.setPrototypeOf(obj, proto);
            if (obj.a === "proto-m") print("[SUCCESS]");
            */
          },
        },
        {
          name: "non-computed setter",
          exec: function () {
            /*
            var captured;
            var proto = {};
            Object.defineProperty(proto, "x", {
              set: function (v) { captured = v; },
              configurable: true,
            });
            var obj = { set a(v) { super.x = v; } };
            Object.setPrototypeOf(obj, proto);
            obj.a = 99;
            if (captured === 99) print("[SUCCESS]");
            */
          },
        },
      ],
    },
  ],
};
