<?php
/**
 * Cart / checkout integration: add design to cart and display cart item meta.
 *
 * @package BIK_Custom_Key_Tag
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate a design ID (alphanumeric, dash, underscore; reasonable length).
 *
 * @param string $design_id Raw design ID.
 * @return string|false Sanitized ID or false.
 */
function bik_ckt_sanitize_design_id( $design_id ) {
	$design_id = sanitize_text_field( (string) $design_id );
	if ( '' === $design_id || strlen( $design_id ) > 128 ) {
		return false;
	}
	if ( ! preg_match( '/^[A-Za-z0-9_-]+$/', $design_id ) ) {
		return false;
	}
	return $design_id;
}

/**
 * Fetch design metadata from the studio API.
 *
 * Expected studio stub: GET {studio}/api/designs/{id}
 * Authorization: Bearer {shared_secret} OR header X-BIK-CKT-Secret: {shared_secret}
 * Response JSON: { "id", "previewUrl" | "preview_url" | "previewDataUrl", ... }
 *
 * @param string $design_id Design ID.
 * @return array{preview_url?: string, raw?: array}|WP_Error
 */
function bik_ckt_fetch_design_meta( $design_id ) {
	$base   = untrailingslashit( (string) bik_ckt_get_option( 'studio_base_url' ) );
	$secret = (string) bik_ckt_get_option( 'shared_secret' );

	if ( '' === $base ) {
		return new WP_Error( 'bik_ckt_no_studio', __( 'Studio base URL is not configured.', 'bik-custom-key-tag' ) );
	}

	$url = $base . '/api/designs/' . rawurlencode( $design_id );

	$headers = array(
		'Accept' => 'application/json',
	);
	if ( '' !== $secret ) {
		$headers['Authorization']     = 'Bearer ' . $secret;
		$headers['X-BIK-CKT-Secret']  = $secret;
	}

	$response = wp_remote_get(
		$url,
		array(
			'timeout' => 12,
			'headers' => $headers,
		)
	);

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$code = (int) wp_remote_retrieve_response_code( $response );
	$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

	if ( $code < 200 || $code >= 300 || ! is_array( $body ) ) {
		// Soft-fail: cart still works without preview metadata.
		return array();
	}

	$design = isset( $body['design'] ) && is_array( $body['design'] ) ? $body['design'] : $body;

	$preview = '';
	foreach ( array( 'previewUrl', 'preview_url', 'previewDataUrl', 'preview_data_url' ) as $key ) {
		if ( ! empty( $design[ $key ] ) && is_string( $design[ $key ] ) ) {
			$preview = $design[ $key ];
			break;
		}
	}

	$result = array( 'raw' => $design );
	if ( '' !== $preview ) {
		// Allow data URLs from studio; otherwise require http(s).
		if ( 0 === strpos( $preview, 'data:image/' ) ) {
			$result['preview_url'] = $preview;
		} else {
			$safe = esc_url_raw( $preview );
			if ( $safe ) {
				$result['preview_url'] = $safe;
			}
		}
	}

	return $result;
}

/**
 * Add configured product to cart with design meta and redirect to cart.
 *
 * @param string $design_id Design ID.
 * @return void
 */
function bik_ckt_add_design_to_cart_and_redirect( $design_id ) {
	$design_id = bik_ckt_sanitize_design_id( $design_id );
	if ( ! $design_id ) {
		wc_add_notice( __( 'Invalid design ID.', 'bik-custom-key-tag' ), 'error' );
		wp_safe_redirect( wc_get_cart_url() );
		exit;
	}

	$product_id = absint( bik_ckt_get_option( 'product_id' ) );
	if ( $product_id <= 0 ) {
		wc_add_notice( __( 'Custom key tag product is not configured yet.', 'bik-custom-key-tag' ), 'error' );
		wp_safe_redirect( home_url( '/' ) );
		exit;
	}

	$product = wc_get_product( $product_id );
	if ( ! $product || ! $product->is_purchasable() ) {
		wc_add_notice( __( 'Custom key tag product is not available.', 'bik-custom-key-tag' ), 'error' );
		wp_safe_redirect( home_url( '/' ) );
		exit;
	}

	$preview_url = '';
	$meta        = bik_ckt_fetch_design_meta( $design_id );
	if ( ! is_wp_error( $meta ) && ! empty( $meta['preview_url'] ) ) {
		$preview_url = $meta['preview_url'];
	}

	$cart_item_data = array(
		'bik_design_id'         => $design_id,
		'bik_design_preview_url' => $preview_url,
		// Unique key so each design is a separate line item.
		'unique_key'            => md5( $design_id . microtime( true ) ),
	);

	if ( ! WC()->cart ) {
		wc_load_cart();
	}

	$added = WC()->cart->add_to_cart( $product_id, 1, 0, array(), $cart_item_data );

	if ( ! $added ) {
		wc_add_notice( __( 'Could not add the custom key tag to the cart.', 'bik-custom-key-tag' ), 'error' );
	}

	wp_safe_redirect( wc_get_cart_url() );
	exit;
}

/**
 * Query-string redirect handler: /?bik_ckt_design={id} and legacy /?bik_add_custom_tag=1&design_id=XXX
 */
function bik_ckt_handle_query_add_to_cart() {
	if ( is_admin() || ! class_exists( 'WooCommerce' ) ) {
		return;
	}

	$design_id = '';

	if ( isset( $_GET['bik_ckt_design'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$design_id = wp_unslash( $_GET['bik_ckt_design'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	} elseif ( isset( $_GET['bik_add_custom_tag'], $_GET['design_id'] ) && '1' === (string) $_GET['bik_add_custom_tag'] ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$design_id = wp_unslash( $_GET['design_id'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	}

	if ( '' === $design_id ) {
		return;
	}

	bik_ckt_add_design_to_cart_and_redirect( $design_id );
}
add_action( 'template_redirect', 'bik_ckt_handle_query_add_to_cart' );

/**
 * REST: POST /wp-json/bik-ckt/v1/add-to-cart
 * Body or query: design_id. Redirects to cart (browser-friendly) or returns JSON if Accept: application/json.
 */
function bik_ckt_register_rest_routes() {
	register_rest_route(
		'bik-ckt/v1',
		'/add-to-cart',
		array(
			'methods'             => array( 'GET', 'POST' ),
			'callback'            => 'bik_ckt_rest_add_to_cart',
			'permission_callback' => '__return_true',
			'args'                => array(
				'design_id' => array(
					'required'          => true,
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
				),
			),
		)
	);
}
add_action( 'rest_api_init', 'bik_ckt_register_rest_routes' );

/**
 * REST callback for add-to-cart.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error|void
 */
function bik_ckt_rest_add_to_cart( WP_REST_Request $request ) {
	$design_id = bik_ckt_sanitize_design_id( $request->get_param( 'design_id' ) );
	if ( ! $design_id ) {
		return new WP_Error( 'bik_ckt_invalid_design', __( 'Invalid design ID.', 'bik-custom-key-tag' ), array( 'status' => 400 ) );
	}

	$wants_json = false;
	$accept     = (string) $request->get_header( 'accept' );
	if ( false !== stripos( $accept, 'application/json' ) ) {
		$wants_json = true;
	}
	if ( '1' === $request->get_param( 'json' ) ) {
		$wants_json = true;
	}

	if ( ! $wants_json ) {
		// Browser redirect flow (studio opens this URL).
		bik_ckt_add_design_to_cart_and_redirect( $design_id );
	}

	// JSON API path (programmatic clients).
	$product_id = absint( bik_ckt_get_option( 'product_id' ) );
	if ( $product_id <= 0 ) {
		return new WP_Error( 'bik_ckt_no_product', __( 'Product ID not configured.', 'bik-custom-key-tag' ), array( 'status' => 503 ) );
	}

	$preview_url = '';
	$meta        = bik_ckt_fetch_design_meta( $design_id );
	if ( ! is_wp_error( $meta ) && ! empty( $meta['preview_url'] ) ) {
		$preview_url = $meta['preview_url'];
	}

	if ( ! WC()->cart ) {
		wc_load_cart();
	}

	$cart_item_data = array(
		'bik_design_id'          => $design_id,
		'bik_design_preview_url' => $preview_url,
		'unique_key'             => md5( $design_id . microtime( true ) ),
	);

	$added = WC()->cart->add_to_cart( $product_id, 1, 0, array(), $cart_item_data );
	if ( ! $added ) {
		return new WP_Error( 'bik_ckt_add_failed', __( 'Could not add to cart.', 'bik-custom-key-tag' ), array( 'status' => 500 ) );
	}

	return rest_ensure_response(
		array(
			'success'     => true,
			'design_id'   => $design_id,
			'cart_url'    => wc_get_cart_url(),
			'preview_url' => $preview_url,
		)
	);
}

/**
 * Make cart item data visible / unique.
 *
 * @param array $cart_item_data Cart item data.
 * @param int   $product_id Product ID.
 * @param int   $variation_id Variation ID.
 * @return array
 */
function bik_ckt_add_cart_item_data( $cart_item_data, $product_id, $variation_id ) {
	unset( $variation_id );
	return $cart_item_data;
}
add_filter( 'woocommerce_add_cart_item_data', 'bik_ckt_add_cart_item_data', 10, 3 );

/**
 * Display design meta on cart and checkout.
 *
 * @param array $item_data Displayed item data.
 * @param array $cart_item Cart item.
 * @return array
 */
function bik_ckt_display_cart_item_data( $item_data, $cart_item ) {
	if ( empty( $cart_item['bik_design_id'] ) ) {
		return $item_data;
	}

	$item_data[] = array(
		'key'     => __( 'Design ID', 'bik-custom-key-tag' ),
		'value'   => esc_html( $cart_item['bik_design_id'] ),
		'display' => '',
	);

	if ( ! empty( $cart_item['bik_design_preview_url'] ) ) {
		$url = $cart_item['bik_design_preview_url'];
		if ( 0 === strpos( $url, 'data:image/' ) ) {
			$thumb = '<img src="' . esc_attr( $url ) . '" alt="" style="max-width:80px;height:auto;border-radius:4px;" />';
		} else {
			$thumb = '<img src="' . esc_url( $url ) . '" alt="" style="max-width:80px;height:auto;border-radius:4px;" />';
		}
		$item_data[] = array(
			'key'     => __( 'Design preview', 'bik-custom-key-tag' ),
			'value'   => $thumb,
			'display' => $thumb,
		);
	}

	return $item_data;
}
add_filter( 'woocommerce_get_item_data', 'bik_ckt_display_cart_item_data', 10, 2 );

/**
 * Persist design meta onto order line items.
 *
 * @param WC_Order_Item_Product $item Order item.
 * @param string                $cart_item_key Cart key.
 * @param array                 $values Cart values.
 * @param WC_Order              $order Order.
 */
function bik_ckt_checkout_create_order_line_item( $item, $cart_item_key, $values, $order ) {
	unset( $cart_item_key, $order );

	if ( ! empty( $values['bik_design_id'] ) ) {
		$item->add_meta_data( '_bik_design_id', sanitize_text_field( $values['bik_design_id'] ), true );
		$item->add_meta_data( __( 'Design ID', 'bik-custom-key-tag' ), sanitize_text_field( $values['bik_design_id'] ), true );
	}
	if ( ! empty( $values['bik_design_preview_url'] ) ) {
		$item->add_meta_data( '_bik_design_preview_url', $values['bik_design_preview_url'], true );
	}
}
add_action( 'woocommerce_checkout_create_order_line_item', 'bik_ckt_checkout_create_order_line_item', 10, 4 );

/**
 * Show design ID in admin order items (hidden keys already prefixed with _).
 *
 * @param string        $display_value Displayed value.
 * @param WC_Meta_Data  $meta Meta.
 * @param WC_Order_Item $item Item.
 * @return string
 */
function bik_ckt_order_item_display_meta( $display_value, $meta, $item ) {
	unset( $item );
	if ( '_bik_design_preview_url' === $meta->key && ! empty( $meta->value ) ) {
		$url = $meta->value;
		if ( 0 === strpos( $url, 'data:image/' ) ) {
			return '<img src="' . esc_attr( $url ) . '" alt="" style="max-width:100px;height:auto;" />';
		}
		return '<a href="' . esc_url( $url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Preview', 'bik-custom-key-tag' ) . '</a>';
	}
	return $display_value;
}
add_filter( 'woocommerce_order_item_display_meta_value', 'bik_ckt_order_item_display_meta', 10, 3 );

/**
 * Hide internal meta keys from customer-facing order emails / views where appropriate.
 *
 * @param array $hidden Hidden keys.
 * @return array
 */
function bik_ckt_hidden_order_item_meta( $hidden ) {
	$hidden[] = '_bik_design_id';
	$hidden[] = '_bik_design_preview_url';
	return $hidden;
}
add_filter( 'woocommerce_hidden_order_itemmeta', 'bik_ckt_hidden_order_item_meta' );
