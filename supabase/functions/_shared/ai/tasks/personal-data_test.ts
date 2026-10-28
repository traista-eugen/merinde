import { assertEquals } from "jsr:@std/assert@^1";
import { scrubPersonalData } from "./personal-data.ts";

function scrub(text: string) {
  return scrubPersonalData(text);
}

Deno.test("card numbers: masked, grouped, plain and Amex forms are removed", () => {
  for (
    const card of [
      "4111 1111 1111 1111",
      "4111-1111-1111-1111",
      "**** **** **** 1234",
      "************1111",
      "411111******1111",
      "XXXXXXXXXXXX1111",
      "4111111111111111",
      "3782 822463 10005",
    ]
  ) {
    const result = scrub(`PLATA ${card} 49,98`);
    assertEquals(result.text, "PLATA 49,98", card);
    assertEquals(result.found, ["card"], card);
  }
});

Deno.test("card numbers: a labelled card line loses every digit of the number", () => {
  const result = scrub("CARD 4111 1111 1111 1111 49,98");
  assertEquals(/\d{4}/.test(result.text), false, result.text);
  assertEquals(result.found.length > 0, true);
});

Deno.test("iban, email and phone numbers are removed", () => {
  assertEquals(scrub("Cont RO49AAAA1B31007593840000 ok").text, "Cont ok");
  assertEquals(scrub("Cont RO49 AAAA 1B31 0075 9384 0000").found, ["iban"]);
  assertEquals(
    scrub("Trimis la ana.pop@example.com azi").text,
    "Trimis la azi",
  );
  for (
    const phone of [
      "0721 234 567",
      "0721234567",
      "+40 721 234 567",
      "0040721234567",
      "021 123 4567",
    ]
  ) {
    assertEquals(scrub(`Tel ${phone} gata`).text, "Tel gata", phone);
    assertEquals(scrub(`Tel ${phone} gata`).found, ["phone"], phone);
  }
});

Deno.test("national id: a valid CNP is removed, an EAN-13 barcode is not", () => {
  // 1800101221144 has a valid CNP control digit and an invalid EAN-13 one.
  assertEquals(scrub("CNP 1800101221144 client").text, "CNP client");
  assertEquals(scrub("CNP 1800101221144 client").found, ["national_id"]);
  for (const ean of ["5941355000688", "5949084021516", "3560070799817"]) {
    assertEquals(scrub(`LAPTE ${ean}`), { text: `LAPTE ${ean}`, found: [] });
  }
  // Right length, wrong control digit: not a CNP.
  assertEquals(scrub("1800101221145").found, []);
});

Deno.test("loyalty ids are removed with their label, program names stay", () => {
  assertEquals(scrub("Card client: 9876 5432 1098").found, ["loyalty"]);
  assertEquals(scrub("Card client: 9876 5432 1098").text, "");
  assertEquals(scrub("Mega Card 0012345678 puncte 4").text, "puncte 4");
  assertEquals(scrub("Lidl Plus 123456789").text, "");
  assertEquals(scrub("KAUFLAND CARD nr. 7001 2345 6789").found, ["loyalty"]);
  // A discount line names the program but carries no ID.
  for (
    const line of [
      "LIDL PLUS REDUCERE -3,00",
      "Kaufland Card -1,50",
      "REDUCERE CARD -2,00",
      "CARD CADOU 100",
    ]
  ) {
    assertEquals(scrub(line), { text: line, found: [] }, line);
  }
});

Deno.test("staff and customer names are removed from the label to the end of the line", () => {
  assertEquals(scrub("Casier: Ioana Popescu"), { text: "", found: ["staff"] });
  assertEquals(scrub("CASIERA 03 Maria Ionescu").found, ["staff"]);
  assertEquals(scrub("Operator: 12").text, "");
  assertEquals(scrub("Client: Ion Vasilescu").found, ["staff"]);
  assertEquals(scrub("Vânzător: Dan").text, "");
  assertEquals(
    scrub("TOTAL 12,50\nCasier: Ana B.\nMULTUMIM").text,
    "TOTAL 12,50 MULTUMIM",
  );
});

Deno.test("ordinary receipt text is left untouched", () => {
  for (
    const line of [
      "LAPTE 3.5% 1L",
      "2 x 5,49 = 10,98",
      "BANANE 1,215 KG x 6,99",
      "GARL 250G 4,99 B",
      "TVA B 9% 1,23",
      "SACOSA BIO 0,45",
      "GARANTIE SGR 0,50",
      "Pret client 5,99",
      "13:45 28-10-2026",
    ]
  ) {
    assertEquals(scrub(line), { text: line, found: [] }, line);
  }
});
