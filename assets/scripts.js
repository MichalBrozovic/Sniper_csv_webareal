const mergeData = () => {
  const productsPath = "/files/all_products.csv";
  const variantsPath = "/files/all_variants.csv";
  const ciselnikPath = "/files/all_ciselnik.csv";
  const outputPath = "output.csv"; // Změněno na název souboru
  const imagesOutputPath = "images_output.csv";
  const xmlFeed = "/files/odberatele.xml";

  const productsLimit = 1000000;
  const country = "SK"; // Změňte na "SK" pro Slovensko

  const manufacture = "Výrobca";

  fetch(productsPath)
    .then((response) => response.text())
    .then((csv) => {
      const parsedData = Papa.parse(csv, {
        header: true,
        transformHeader: (header) => header.trim(),
      });
      const productsData = parsedData.data.slice(0, productsLimit);
      const productsHeader = parsedData.meta.fields;
      console.log("Products Header:", productsHeader);

      // Předpokládáme, že ID je v prvním sloupci a Kod vyrobku je ve druhém sloupci
      const idIndex = 0;
      const codeIndex = 1;
      const nameIndex = productsHeader.indexOf("Nazov vyrobku");
      const parametersIndex = 54; // Index pro "Parametre"

      console.log("Products Data:", productsData);

      fetch(variantsPath)
        .then((response) => response.text())
        .then((csv) => {
          const parsedData = Papa.parse(csv, {
            header: true,
            transformHeader: (header) => header.trim(),
          });
          const variantsData = parsedData.data;
          const variantsHeader = parsedData.meta.fields;
          console.log("Variants Header:", variantsHeader);

          // Předpokládáme, že ID je v prvním sloupci a Pripojit ciselnik vlastnosti je ve 13. sloupci
          const variantIdIndex = 0;
          const variantNameIndex = variantsHeader.indexOf("Nazov vyrobku");
          const ciselnikIndex = 12;

          fetch(ciselnikPath)
            .then((response) => response.text())
            .then((csv) => {
              const parsedData = Papa.parse(csv, {
                header: true,
                transformHeader: (header) => header.trim(),
              });
              const ciselnikData = parsedData.data;
              const ciselnikHeader = parsedData.meta.fields;
              console.log("Ciselnik Header:", ciselnikHeader);

              // Vytvoříme mapu parametrů
              const parametersMap = {};
              ciselnikData.forEach((entry) => {
                const [id, order] = entry[ciselnikHeader[0]].split("-");
                if (!parametersMap[id]) {
                  parametersMap[id] = {
                    name: "",
                    values: {},
                  };
                }
                if (order === "0") {
                  parametersMap[id].name = entry[ciselnikHeader[1]];
                } else {
                  parametersMap[id].values[entry[ciselnikHeader[0]]] =
                    entry[ciselnikHeader[1]];
                }
              });

              fetch(xmlFeed)
                .then((response) => response.text())
                .then((xml) => {
                  const parser = new DOMParser();
                  const xmlDoc = parser.parseFromString(xml, "text/xml");

                  const outputData = [];
                  const imagesOutputData = [];

                  productsData.forEach((product) => {
                    const productId = product[productsHeader[idIndex]];
                    const productName = product[productsHeader[nameIndex]];
                    if (productId) {
                      const trimmedProductId = productId.trim(); // Trim to remove any extra spaces
                      const variantID = trimmedProductId + "_";

                      const productVariants = variantsData.filter(
                        (variant) =>
                          variant[variantsHeader[variantIdIndex]] &&
                          variant[variantsHeader[variantIdIndex]].startsWith(
                            variantID
                          )
                      );
                      console.log(
                        `Variants for Product ID ${trimmedProductId}:`,
                        productVariants
                      );

                      // Najdeme cestu k obrázku a URL v XML feedu pomocí XPath
                      const codeValue = product[productsHeader[codeIndex]];
                      const xpathImg = `//SHOPITEM[CODE='${codeValue}']/IMGURL`;
                      const xpathUrl = `//SHOPITEM[CODE='${codeValue}']/URL`;
                      const imgUrlNode = xmlDoc.evaluate(
                        xpathImg,
                        xmlDoc,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                      ).singleNodeValue;
                      const urlNode = xmlDoc.evaluate(
                        xpathUrl,
                        xmlDoc,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                      ).singleNodeValue;
                      const imgUrlBase = imgUrlNode
                        ? imgUrlNode.textContent.replace(/[^/]*$/, "")
                        : "";
                      const productUrl = urlNode ? urlNode.textContent : "";

                      // Přidáme master produkt
                      const longDescription = product[productsHeader[4]];
                      const imgTags = longDescription.match(
                        /<img[^>]+src="[^"]+"[^>]*>/g
                      );
                      if (imgTags) {
                        imgTags.forEach((imgTag) => {
                          imagesOutputData.push({
                            "[PRODUCT_CODE]":
                              product[productsHeader[codeIndex]],
                            "[PRODUCT_NAME]":
                              product[productsHeader[nameIndex]],
                            "[IMG_TAG]": imgTag,
                          });
                        });
                      }

                      const masterProduct = {
                        "[PRODUCT_CODE]": product[productsHeader[codeIndex]],
                        "[PRICE_ORIGINAL]": product[productsHeader[6]],
                        "[EAN]": product[productsHeader[35]],
                        "[WEIGHT]": product[productsHeader[37]],
                        "[VARIANT_YN]": 0,
                        "[VARIANT_CODE]": "",
                        "[MAIN_YN]": "",
                        "[ACTIVE_YN]":
                          product[productsHeader[40]] === "1" ? "0" : "1",
                        "[ARCHIVED_YN]": 0,
                        "[CAN_ADD_TO_BASKET_YN]": 1,
                        "[NEW_YN]": product[productsHeader[24]],
                        "[LABEL_ACTIVE_YN]": "",
                        "[URL]": productUrl,
                        "[TITLE]": product[productsHeader[nameIndex]],
                        "[SHORT_DESCRIPTION]": product[productsHeader[3]],
                        "[LONG_DESCRIPTION]": longDescription,
                        "[MANUFACTURER]": product[productsHeader[34]],
                        "[STOCK]": product[productsHeader[26]],
                        "[UNIT]": product[productsHeader[11]],
                        "[VAT]":
                          country === "SK"
                            ? product[productsHeader[33]] === "1"
                              ? "10%"
                              : product[productsHeader[33]] === "2"
                              ? "19%"
                              : "23%"
                            : product[productsHeader[33]] === "1"
                            ? "12%"
                            : "21%",
                        "[CATEGORIES]": (() => {
                          const categories = product[productsHeader[12]].split("|");
                          if (categories.length > 0) {
                            const firstCategory = categories[0];
                            const mainCategory = firstCategory.replace(/-.*/, "-000-000-000");
                            categories.unshift(mainCategory); // Přidáme hlavní kategorii na začátek
                          }
                          return categories.join(";");
                        })(),
                        "[IMAGES]": [
                          product[productsHeader[7]],
                          product[productsHeader[16]],
                          product[productsHeader[17]],
                          product[productsHeader[18]],
                          product[productsHeader[19]],
                          product[productsHeader[20]],
                          product[productsHeader[21]],
                        ]
                          .filter(Boolean)
                          .map((img) => imgUrlBase + img)
                          .join(";"),
                        "[FILES]": product[productsHeader[9]],
                        "[RELATED]": product[productsHeader[22]]
                          .split("|")
                          .join(";"),
                      };

                      // Přidáme parametry do master produktu
                      const parameters =
                        product[productsHeader[parametersIndex]];
                      if (parameters) {
                        const paramsArray = parameters.split("|-|");
                        paramsArray.forEach((param) => {
                          const [paramName, paramValue] = param.split("#-#");
                          if (paramName.trim() === manufacture) {
                            masterProduct["[MANUFACTURER]"] = paramValue.trim();
                          } else {
                            masterProduct[`[PARAMETER "${paramName.trim()}"]`] =
                              paramValue.trim();
                          }
                        });
                      }

                      // Přidáme prázdné parametry z ciselniku
                      Object.keys(parametersMap).forEach((paramId) => {
                        if (
                          !masterProduct.hasOwnProperty(
                            `[PARAMETER "${parametersMap[paramId].name}"]`
                          )
                        ) {
                          masterProduct[
                            `[PARAMETER "${parametersMap[paramId].name}"]`
                          ] = "";
                        }
                      });

                      outputData.push(masterProduct);

                      // Přidáme varianty produktu
                      productVariants.forEach((variant) => {
                        const variantId =
                          variant[variantsHeader[variantIdIndex]];
                        const variantName =
                          variant[variantsHeader[variantNameIndex]];
                        const ciselnikColumn =
                          variant[variantsHeader[ciselnikIndex]];
                        let variantCode = variant[variantsHeader[1]];
                        if (ciselnikColumn) {
                          variantCode +=
                            "-" + ciselnikColumn.split("|").join("-");
                        }

                        const variantProduct = {
                          "[PRODUCT_CODE]": product[productsHeader[codeIndex]],
                          "[PRICE_ORIGINAL]": variant[variantsHeader[5]],
                          "[EAN]": variant[variantsHeader[16]],
                          "[WEIGHT]": variant[variantsHeader[17]],
                          "[VARIANT_YN]": 1,
                          "[VARIANT_CODE]": variantCode,
                          "[MAIN_YN]": 0,
                          "[ACTIVE_YN]":
                            variant[variantsHeader[18]] === "1" ? "0" : "1",
                          "[ARCHIVED_YN]": 0,
                          "[CAN_ADD_TO_BASKET_YN]": "",
                          "[NEW_YN]": "",
                          "[LABEL_ACTIVE_YN]": "",
                          "[SHORT_DESCRIPTION]": variant[variantsHeader[3]],
                          "[LONG_DESCRIPTION]": "",
                          "[MANUFACTURER]": "",
                          "[STOCK]": variant[variantsHeader[14]],
                          "[UNIT]": variant[variantsHeader[8]],
                          "[VAT]": "",
                          "[CATEGORIES]": "",
                          "[IMAGES]": variant[variantsHeader[6]]
                            ? imgUrlBase + variant[variantsHeader[6]]
                            : "",
                          "[FILES]": "",
                          "[RELATED]": "",
                        };

                        // Přidáme parametry do varianty
                        Object.keys(parametersMap).forEach((paramId) => {
                          const paramValue = ciselnikColumn
                            .split("|")
                            .map((value) => {
                              const [paramIdPart, paramValuePart] = value
                                .trim()
                                .split("-");
                              return paramId === paramIdPart
                                ? parametersMap[paramId].values[value.trim()]
                                : "";
                            })
                            .filter(Boolean)
                            .join(";");
                          variantProduct[
                            `[PARAMETER "${parametersMap[paramId].name}"]`
                          ] = paramValue;
                        });

                        outputData.push(variantProduct);
                      });
                    } else {
                      console.error(
                        `Product ID is undefined for product:`,
                        product
                      );
                    }
                  });

                  const csvContent = Papa.unparse(outputData, {
                    delimiter: ";",
                  });
                  downloadCSV(csvContent, outputPath);

                  const imagesCsvContent = Papa.unparse(imagesOutputData, {
                    delimiter: ";",
                  });
                  downloadCSV(imagesCsvContent, imagesOutputPath);
                });
            });
        });
    });
};

const downloadCSV = (csvContent, outputPath) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", outputPath);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Příklad použití
mergeData();