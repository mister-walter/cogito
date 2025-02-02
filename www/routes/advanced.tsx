import outdent from 'https://deno.land/x/outdent@v0.8.0/mod.ts';
import { Try } from '../islands/Try.tsx';

export default function Advanced() {
  return (
    <>
      <div class='main-header'>
        <h1>Cogito</h1>
      </div>
      <h2>Advanced features</h2>
      <section>
        <h3>Mutual recursion</h3>
        <Try
          initialSource={outdent`
            mutual {
              function even(n: natural) {
                if (n == 0) {
                  return t;
                }
                return !odd(n - 1);
              }

              function odd(n: natural) {
                if (n == 0) {
                  return nil;
                }
                return !even(n - 1);
              }
            }
          `}
        />
      </section>
      <section>
        <h3>Structs</h3>
        <Try
          initialSource={outdent`
            struct point(x: number, y: number);

            function dist-sq(p1: point, p2: point) {
              return (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
            }
          `}
        />
      </section>
      <section>
        <h3>Higher order builtins</h3>
        <Try
          initialSource={outdent`
            main {
              jenny = [8, 6, 7, 5, 3, 0, 9];

              print("Sum: ~x0",
                reduce(jenny, (x: number, y: number) => x + y, 0)
              );
              print("Add 1: ~x0",
                map(jenny, (x: number) => x + 1)
              );
              print("Duplicate: ~x0",
                flat-map(jenny, (x: number) => [x, x])
              );
              print("Evens: ~x0",
                filter(jenny, (x: number) => is-even(x))
              );
              print("Zip: ~x0",
                zip-with(
                  jenny,
                  [1, 2, 3],
                  (x: number, y: number) => x + y
                )
              );
            }
          `}
        />
      </section>
      <section>
        <h3>Switch expressions</h3>
        <Try
          initialSource={outdent`
            function classify(x: number) {
              return switch (x) {
                case 0: "zero";
                case 1: "one";
                case 2: "two";
                default: "other";
              };
            }
          `}
        />
      </section>
      <section>
        <h3>Imports</h3>
        <Try initialSource='import "arithmetic-5/top" from "system";' />
      </section>
    </>
  );
}
