export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("OK");
    }

    const body = await request.text();

    const response = await fetch(
      "https://parseapi.back4app.com/functions/mpesaCallback",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Parse-Application-Id": "e2Hjqf2YrwsnJz24RMp4Il9nw50rEYhy2C92ptNj",
          "X-Parse-REST-API-Key": "ovuEdF6I8sqU4r3PMsEzUcwCTujhSEkuxnn8n1Me"
        },
        body
      }
    );

    return new Response("OK");
  }
};