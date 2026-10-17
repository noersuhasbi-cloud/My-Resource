package com.aistudio.grocemart.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.grocemart.model.StoreLocation
import com.aistudio.grocemart.ui.theme.*
import com.aistudio.grocemart.viewmodel.GroceMartViewModel

@Composable
fun StoreLocationsScreen(
    viewModel: GroceMartViewModel,
    modifier: Modifier = Modifier
) {
    val stores by viewModel.stores.collectAsState()
    val selectedStore by viewModel.selectedStore.collectAsState()
    var selectedCity by remember { mutableStateOf("All") }
    var searchQuery by remember { mutableStateOf("") }

    val cities = listOf("All", "Jakarta", "Bandung", "Surabaya", "Bali", "Yogyakarta", "Medan")

    val filteredStores = stores.filter { store ->
        val matchesCity = (selectedCity == "All") || store.city.equals(selectedCity, ignoreCase = true)
        val matchesQuery = searchQuery.isBlank() ||
                store.name.contains(searchQuery, ignoreCase = true) ||
                store.address.contains(searchQuery, ignoreCase = true) ||
                store.district.contains(searchQuery, ignoreCase = true)
        matchesCity && matchesQuery
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Stone50)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Column {
                Text(
                    text = "34 Store Outlets Nationwide",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = Stone900
                )
                Text(
                    text = "Pick up your order or receive 1-hour cold-chain dispatch from the nearest branch.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Stone600
                )
            }
        }

        // Search Input
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search by district or store name...", color = Stone600) },
                leadingIcon = { Icon(imageVector = Icons.Default.Search, contentDescription = null, tint = EmeraldPrimary) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = EmeraldPrimary,
                    unfocusedBorderColor = Stone300,
                    focusedContainerColor = PureWhite,
                    unfocusedContainerColor = PureWhite
                ),
                modifier = Modifier.fillMaxWidth().testTag("store_search_input")
            )
        }

        // City Selector Chips
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                cities.forEach { city ->
                    FilterChip(
                        selected = selectedCity == city,
                        onClick = { selectedCity = city },
                        label = { Text(city) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = EmeraldPrimary,
                            selectedLabelColor = PureWhite,
                            containerColor = Stone100,
                            labelColor = Stone800
                        ),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.testTag("city_chip_$city")
                    )
                }
            }
        }

        items(filteredStores, key = { it.id }) { store ->
            val isCurrent = store.id == selectedStore.id

            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth().testTag("store_card_${store.id}")
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = store.name,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = Stone900
                            )
                            Text(
                                text = "${store.city} · Est. ${store.establishedYear}",
                                style = MaterialTheme.typography.labelSmall,
                                color = Stone600
                            )
                        }

                        if (store.isFlagship) {
                            Surface(
                                color = AmberContainer,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = "FLAGSHIP",
                                    color = OnAmberContainer,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = "${store.address}, ${store.district} (${store.postalCode})",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Stone800
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(imageVector = Icons.Default.AccessTime, contentDescription = null, tint = EmeraldPrimary, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = store.hours, style = MaterialTheme.typography.bodyMedium, color = Stone800)

                        Spacer(modifier = Modifier.width(16.dp))

                        Icon(imageVector = Icons.Default.Phone, contentDescription = null, tint = EmeraldPrimary, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = store.phone, style = MaterialTheme.typography.bodyMedium, color = Stone800)
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Amenities chips
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        store.amenities.forEach { amenity ->
                            Surface(
                                color = Stone100,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = amenity,
                                    color = Stone800,
                                    fontSize = 11.sp,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Manager: ${store.manager}",
                            style = MaterialTheme.typography.labelSmall,
                            color = Stone600
                        )

                        if (isCurrent) {
                            Surface(
                                color = EmeraldContainer,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Icon(imageVector = Icons.Default.Check, contentDescription = null, tint = EmeraldDark, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(text = "Selected Outlet", color = EmeraldDark, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }
                        } else {
                            OutlinedButton(
                                onClick = { viewModel.selectStore(store) },
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                modifier = Modifier.testTag("select_store_${store.id}")
                            ) {
                                Text("Select as My Store")
                            }
                        }
                    }
                }
            }
        }
    }
}
